import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Create a local prisma instance for this service
const prisma = new PrismaClient();

interface FlashInfoSuggestion {
  "CE QU'IL FAUT SAVOIR AVANT DE COMMENCER LA JOURNÉE": number[];
  "CE DONT TOUT LE MONDE PARLE": number[];  
  "À LIRE AUSSI": number[];
  [key: string]: number[]; // Index signature to allow string indexing
}

interface Article {
  ID: bigint;
  post_title: string;
  post_excerpt: string;
  post_date: Date | null;
  meta?: {
    meta_key: string | null;
    meta_value: string | null;
  }[];
}

export class FlashInfoService {
  private static genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

  /**
   * Generate Flash Info data for the specified date
   */
  static async generateFlashInfo(targetDate?: Date, forceRegenerate: boolean = false): Promise<{
    generated: boolean;
    existingCount: number;
    newCount: number;
    articlesFound: number;
  }> {
    const date = targetDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    console.log(`🚀 Generating Flash Info for ${dateOnly.toISOString().split('T')[0]} (force: ${forceRegenerate})`);

    // Check if we already have flash info for this date (use UTC for consistent matching)
    const dateStr = dateOnly.toISOString().split('T')[0]; // YYYY-MM-DD
    const [year, month, day] = dateStr.split('-').map(Number);
    const utcDateOnly = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)); // month is 0-indexed
    
    const existingFlashInfo = await prisma.aiNewsletterSuggestion.findMany({
      where: { 
        type: 'flash-info',
        date: utcDateOnly 
      }
    });

    // Using transactions, we can proceed with generation and it will replace existing data automatically
    if (existingFlashInfo.length > 0) {
      console.log(`📋 Found ${existingFlashInfo.length} existing Flash Info groups for ${dateOnly.toISOString().split('T')[0]}, will replace them in transaction`);
    } else {
      console.log(`📋 No existing Flash Info data found for ${dateOnly.toISOString().split('T')[0]}, creating new data`);
    }

    // Get articles from the specified day using UTC to avoid timezone issues
    // Extract the date components from the UTC string to avoid timezone shifts
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)); // month is 0-indexed
    const endOfDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));

    const articles = await prisma.mod180_posts.findMany({
      where: {
        post_date: {
          gte: startOfDay,
          lt: endOfDay
        },
        post_status: 'publish',
        post_type: 'post'
      },
      include: {
        meta: {
          where: {
            meta_key: {
              in: ['category', 'tags', 'excerpt']
            }
          }
        }
      },
      orderBy: {
        post_date: 'desc'
      }
    });

    if (articles.length === 0) {
      console.log(`❌ No articles found for ${dateOnly.toISOString().split('T')[0]}`);
      return {
        generated: false,
        existingCount: existingFlashInfo.length,
        newCount: 0,
        articlesFound: 0
      };
    }

    console.log(`📰 Found ${articles.length} articles to analyze`);

    // Generate 3 different Flash Info groups using AI
    console.log(`🔄 Starting AI suggestions generation for ${articles.length} articles...`);
    const suggestions = await this.generateAISuggestions(articles);
    console.log(`📋 Generated ${suggestions.length} Flash Info suggestions`);
    
    // Enhanced debugging: Log the full suggestions structure
    if (suggestions.length > 0) {
      console.log('Full suggestions array:', JSON.stringify(suggestions, null, 2));
      console.log('Sample suggestion structure:', {
        keys: Object.keys(suggestions[0]),
        section1Count: suggestions[0]["CE QU'IL FAUT SAVOIR AVANT DE COMMENCER LA JOURNÉE"]?.length,
        section2Count: suggestions[0]["CE DONT TOUT LE MONDE PARLE"]?.length,
        section3Count: suggestions[0]["À LIRE AUSSI"]?.length
      });
    } else {
      console.error('❌ No suggestions generated!');
      throw new Error('AI suggestion generation failed and no suggestions were created');
    }

    let newGroupsCreated = 0;

    // Use transaction to ensure atomicity of delete and create operations
    console.log(`🔄 Starting transaction with ${suggestions.length} suggestions available`);
    const transactionResult = await prisma.$transaction(async (tx) => {
      let created = 0;
      
      // First delete existing data for this date
      if (existingFlashInfo.length > 0) {
        console.log(`🗑️ Deleting ${existingFlashInfo.length} existing Flash Info groups...`);
        const deleteResult = await tx.aiNewsletterSuggestion.deleteMany({
          where: { 
            type: 'flash-info',
            date: utcDateOnly 
          }
        });
        console.log(`🗑️ Deleted ${deleteResult.count} records`);
      }

      // Then create new groups
      console.log(`🔄 Creating new groups from ${suggestions.length} suggestions...`);
      for (let groupNumber = 1; groupNumber <= 3; groupNumber++) {
        const suggestion = suggestions[groupNumber - 1];
        console.log(`🔍 Processing group ${groupNumber}: suggestion exists = ${!!suggestion}`);
        
        if (suggestion) {
          // Validate suggestion structure before saving
          const hasAllSections = suggestion["CE QU'IL FAUT SAVOIR AVANT DE COMMENCER LA JOURNÉE"] && 
                                 suggestion["CE DONT TOUT LE MONDE PARLE"] && 
                                 suggestion["À LIRE AUSSI"];
          
          console.log(`🔍 Group ${groupNumber} validation: hasAllSections = ${hasAllSections}`);
          
          if (hasAllSections) {
            console.log(`🔄 Creating Flash Info group ${groupNumber}...`);
            try {
              const suggestionRecord = await tx.aiNewsletterSuggestion.create({
                data: {
                  type: 'flash-info',
                  date: utcDateOnly,
                  groupNumber,
                  data: suggestion as any
                }
              });
              created++;
              console.log(`✅ Saved Flash Info group ${groupNumber} with ID ${suggestionRecord.id}`);
            } catch (createError) {
              console.error(`❌ Failed to create group ${groupNumber}:`, createError);
            }
          } else {
            console.error(`❌ Group ${groupNumber} has invalid structure - missing required sections`);
          }
        } else {
          console.error(`❌ No suggestion found for group ${groupNumber} (suggestions.length: ${suggestions.length})`);
        }
      }
      
      console.log(`📊 Transaction completed: ${created} groups created out of ${suggestions.length} suggestions`);
      return created;
    });

    newGroupsCreated = transactionResult;

    console.log(`🎉 Flash Info generation completed for ${dateOnly.toISOString().split('T')[0]} (${newGroupsCreated} new groups created)`);

    return {
      generated: true,
      existingCount: existingFlashInfo.length, // Count before deletion
      newCount: newGroupsCreated,
      articlesFound: articles.length
    };
  }

  /**
   * Generate 3 different Flash Info suggestions using Gemini AI
   */
  private static async generateAISuggestions(articles: Article[]): Promise<FlashInfoSuggestion[]> {
    try {
      console.log(`🤖 Initializing Gemini AI model for ${articles.length} articles...`);
      
      if (!process.env.GOOGLE_AI_API_KEY) {
        throw new Error('GOOGLE_AI_API_KEY not configured');
      }
      

      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 8192,
        }
      });

      const articlesData = articles.map(article => ({
        id: Number(article.ID),
        title: article.post_title.trim(),
        excerpt: (article.post_excerpt || '').trim(),
        date: article.post_date ? article.post_date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }));

      // Enhanced prompt with better instructions
      const prompt = `
Tu es un expert en journalisme économique qui doit créer 3 versions différentes de Flash Info pour une newsletter économique quotidienne destinée aux professionnels d'Afrique Centrale.

ARTICLES DISPONIBLES (${articles.length} articles):
${JSON.stringify(articlesData, null, 2)}

MISSION: Créer 3 Flash Info distincts optimisés pour différents profils de lecteurs.

SECTIONS REQUISES pour chaque Flash Info:
1. "CE QU'IL FAUT SAVOIR AVANT DE COMMENCER LA JOURNÉE" - Exactement 5 articles essentiels
2. "CE DONT TOUT LE MONDE PARLE" - Exactement 3 articles tendance/populaires 
3. "À LIRE AUSSI" - Entre 2 et 6 articles complémentaires (recommandé: 4 articles)

CRITÈRES DE SÉLECTION:
- Flash Info 1: Focus dirigeants/décideurs (politique économique, grandes annonces)
- Flash Info 2: Focus marchés/finance (bourses, banques, investissements)  
- Flash Info 3: Focus business/entreprises (PME, secteurs, innovation)

RÈGLES IMPÉRATIVES:
✅ Utilise UNIQUEMENT les IDs fournis dans la liste
✅ Chaque article ne peut apparaître qu'UNE SEULE FOIS dans tout le Flash Info
✅ Les 3 Flash Info doivent être DIFFÉRENTS (maximum 1-2 articles en commun)
✅ Respecte EXACTEMENT le nombre d'articles par section
✅ Retourne UNIQUEMENT le JSON, pas d'explication

FORMAT DE RÉPONSE (JSON uniquement, copie exactement ce format):
[
  {
    "CE QU'IL FAUT SAVOIR AVANT DE COMMENCER LA JOURNÉE": [id1, id2, id3, id4, id5],
    "CE DONT TOUT LE MONDE PARLE": [id6, id7, id8],
    "À LIRE AUSSI": [id9, id10, id11, id12]
  },
  {
    "CE QU'IL FAUT SAVOIR AVANT DE COMMENCER LA JOURNÉE": [id13, id14, id15, id16, id17],
    "CE DONT TOUT LE MONDE PARLE": [id18, id19, id20], 
    "À LIRE AUSSI": [id21, id22, id23, id24]
  },
  {
    "CE QU'IL FAUT SAVOIR AVANT DE COMMENCER LA JOURNÉE": [id25, id26, id27, id28, id29],
    "CE DONT TOUT LE MONDE PARLE": [id30, id31, id32],
    "À LIRE AUSSI": [id33, id34, id35, id36]
  }
]`;

      console.log(`🤖 Sending prompt to Gemini AI...`);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log(`🤖 Received AI response (${text.length} characters)`);

      try {
        // Clean the response to extract JSON
        const cleanedText = text.trim();
        console.log(`🔍 Parsing AI response...`);
        
        // Try multiple extraction methods
        let jsonText = '';
        
        // Method 1: Look for array brackets
        const arrayMatch = cleanedText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          jsonText = arrayMatch[0];
        } else {
          // Method 2: Look for code block
          const codeMatch = cleanedText.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
          if (codeMatch) {
            jsonText = codeMatch[1];
          } else {
            // Method 3: Use entire response if it looks like JSON
            jsonText = cleanedText.startsWith('[') ? cleanedText : '';
          }
        }

        if (!jsonText) {
          throw new Error('No valid JSON array found in AI response');
        }

        const suggestions: FlashInfoSuggestion[] = JSON.parse(jsonText);
        
        // Enhanced validation
        if (!Array.isArray(suggestions)) {
          throw new Error('Response is not an array');
        }
        
        if (suggestions.length !== 3) {
          throw new Error(`Expected 3 suggestions, got ${suggestions.length}`);
        }

        // Validate each suggestion
        for (let i = 0; i < suggestions.length; i++) {
          const suggestion = suggestions[i];
          const requiredKeys = [
            "CE QU'IL FAUT SAVOIR AVANT DE COMMENCER LA JOURNÉE",
            "CE DONT TOUT LE MONDE PARLE", 
            "À LIRE AUSSI"
          ];

          for (const key of requiredKeys) {
            if (!suggestion[key] || !Array.isArray(suggestion[key])) {
              throw new Error(`Missing or invalid section "${key}" in suggestion ${i + 1}`);
            }
          }

          // Validate article counts
          if (suggestion["CE QU'IL FAUT SAVOIR AVANT DE COMMENCER LA JOURNÉE"].length !== 5) {
            throw new Error(`Section 1 should have exactly 5 articles, got ${suggestion["CE QU'IL FAUT SAVOIR AVANT DE COMMENCER LA JOURNÉE"].length} in suggestion ${i + 1}`);
          }
          
          if (suggestion["CE DONT TOUT LE MONDE PARLE"].length !== 3) {
            throw new Error(`Section 2 should have exactly 3 articles, got ${suggestion["CE DONT TOUT LE MONDE PARLE"].length} in suggestion ${i + 1}`);
          }

          const alireLengths = suggestion["À LIRE AUSSI"].length;
          if (alireLengths < 2 || alireLengths > 6) {
            throw new Error(`Section 3 should have 2-6 articles, got ${alireLengths} in suggestion ${i + 1}`);
          }
        }

        console.log(`✅ AI response validated successfully`);
        return suggestions;

      } catch (parseError) {
        console.error('❌ Error parsing AI response:', parseError);
        console.log('📄 Raw AI response:', text);
        throw new Error(`AI response parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

    } catch (error) {
      console.error('❌ AI generation failed:', error);
      
      // Log error details
      if (error instanceof Error) {
        if (error.message.includes('API_KEY')) {
          console.error('🔑 Google AI API key configuration error');
        } else if (error.message.includes('quota') || error.message.includes('limit')) {
          console.error('📊 Google AI API quota exceeded');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          console.error('🌐 Network error contacting Google AI service');
        } else {
          console.error('❓ Unknown AI service error:', error.message);
        }
      }

      console.error('❌ AI suggestion generation failed completely');
      throw error;
    }
  }


  /**
   * Get Flash Info data for a specific date
   */
  static async getFlashInfoByDate(date: Date): Promise<any[]> {
    // Use the same UTC date normalization logic as the creation function
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dateStr = dateOnly.toISOString().split('T')[0]; // YYYY-MM-DD
    const [year, month, day] = dateStr.split('-').map(Number);
    const utcDateOnly = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)); // month is 0-indexed
    
    const suggestions = await prisma.aiNewsletterSuggestion.findMany({
      where: { 
        type: 'flash-info',
        date: utcDateOnly 
      },
      orderBy: { groupNumber: 'asc' }
    });

    // Return simplified format compatible with route expectations
    return suggestions.map((suggestion: any) => {
      const data = suggestion.data as FlashInfoSuggestion;
      
      // Calculate total articles across all sections
      const totalArticles = 
        data["CE QU'IL FAUT SAVOIR AVANT DE COMMENCER LA JOURNÉE"].length +
        data["CE DONT TOUT LE MONDE PARLE"].length +
        data["À LIRE AUSSI"].length;
      
      return {
        id: suggestion.id,
        groupNumber: suggestion.groupNumber,
        date: suggestion.date,
        createdAt: suggestion.createdAt,
        data: data,
        sectionsCount: 3, // Always 3 sections
        totalArticles: totalArticles
      };
    });
  }

  /**
   * Get enriched Flash Info data with article details for a specific date
   */
  static async getEnrichedFlashInfoByDate(date: Date): Promise<any[]> {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dateStr = dateOnly.toISOString().split('T')[0]; // YYYY-MM-DD
    const [year, month, day] = dateStr.split('-').map(Number);
    const utcDateOnly = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)); // month is 0-indexed
    
    const suggestions = await prisma.aiNewsletterSuggestion.findMany({
      where: { 
        type: 'flash-info',
        date: utcDateOnly 
      },
      orderBy: { groupNumber: 'asc' }
    });

    // Transform the data to include post details for each article ID
    const enrichedSuggestions = [];
    
    for (const suggestion of suggestions as any[]) {
      const data = suggestion.data as FlashInfoSuggestion;
      
      // Get all article IDs from this suggestion
      const allArticleIds = [
        ...data["CE QU'IL FAUT SAVOIR AVANT DE COMMENCER LA JOURNÉE"],
        ...data["CE DONT TOUT LE MONDE PARLE"],
        ...data["À LIRE AUSSI"]
      ];
      
      // Fetch article details
      const articles = await prisma.mod180_posts.findMany({
        where: {
          ID: {
            in: allArticleIds.map(id => BigInt(id))
          }
        },
        select: {
          ID: true,
          post_title: true,
          post_excerpt: true,
          post_name: true,
          post_date: true
        }
      });
      
      // Create a lookup map
      const articleMap = new Map();
      articles.forEach((article: any) => {
        articleMap.set(Number(article.ID), {
          ID: Number(article.ID),
          post_title: article.post_title,
          post_excerpt: article.post_excerpt,
          post_name: article.post_name,
          post_date: article.post_date
        });
      });
      
      enrichedSuggestions.push({
        id: suggestion.id,
        groupNumber: suggestion.groupNumber,
        date: suggestion.date,
        createdAt: suggestion.createdAt,
        data: data,
        articles: articleMap
      });
    }
    
    return enrichedSuggestions;
  }

  /**
   * Delete old Flash Info data (keep last 30 days)
   */
  static async cleanupOldFlashInfo(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const deleted = await prisma.aiNewsletterSuggestion.deleteMany({
      where: {
        type: 'flash-info',
        date: {
          lt: thirtyDaysAgo
        }
      }
    });

    console.log(`🧹 Cleaned up ${deleted.count} old Flash Info entries`);
  }
}