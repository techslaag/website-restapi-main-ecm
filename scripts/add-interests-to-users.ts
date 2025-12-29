import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

// Interest IDs to add to all users (Production Database)
const interestIds = [
  'cmjb7capz000tj7lgz791h65i', // Personnalité EcoMatin de l'année  
  'cmjb7caq2000vj7lgmn1hp0c4', // Business et entreprises
  'cmjb7caq8000zj7lggm60pwab', // Banques et finance
  'cmjb7caqa0011j7lg52zsrtyj', // Politiques publiques
  'cmjb7caqd0013j7lgq706n813', // Mine et énergie
  'cmjb7caqf0015j7lgud4nza7g', // Conjoncture
  'cmjb7caqk0019j7lg6t8fvhwp'  // Communiqués
];

async function addInterestsToAllUsers() {
  console.log('🚀 Adding interests to all users...');
  
  try {
    // First, get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    console.log(`👥 Found ${users.length} users`);

    if (users.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    // Verify that all interest IDs exist
    const existingInterests = await prisma.interest.findMany({
      where: {
        id: {
          in: interestIds
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    console.log(`🎯 Found ${existingInterests.length} out of ${interestIds.length} interests`);
    
    if (existingInterests.length !== interestIds.length) {
      const missingInterests = interestIds.filter(
        id => !existingInterests.some(interest => interest.id === id)
      );
      console.log('⚠️  Missing interest IDs:', missingInterests);
    }

    let addedCount = 0;
    let skippedCount = 0;

    // Add interests to each user
    for (const user of users) {
      console.log(`\n📝 Processing user: ${user.email || user.name || user.id}`);

      for (const interestId of existingInterests.map(i => i.id)) {
        try {
          // Check if user already has this interest
          const existingUserInterest = await prisma.userInterest.findUnique({
            where: {
              userId_interestId: {
                userId: user.id,
                interestId: interestId
              }
            }
          });

          if (existingUserInterest) {
            console.log(`   ⏭️  Already has interest ${interestId}`);
            skippedCount++;
            continue;
          }

          // Add the interest to the user
          await prisma.userInterest.create({
            data: {
              userId: user.id,
              interestId: interestId
            }
          });

          const interest = existingInterests.find(i => i.id === interestId);
          console.log(`   ✅ Added interest: ${interest?.name || interestId}`);
          addedCount++;

        } catch (error: any) {
          console.error(`   ❌ Failed to add interest ${interestId}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Summary:');
    console.log(`✅ Total interests added: ${addedCount}`);
    console.log(`⏭️  Total already existing: ${skippedCount}`);
    console.log(`👥 Users processed: ${users.length}`);
    console.log(`🎯 Interests processed: ${existingInterests.length}`);

  } catch (error: any) {
    console.error('❌ Error adding interests to users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to verify the data was added correctly
async function verifyUserInterests() {
  console.log('\n🔍 Verifying user interests...');
  
  try {
    const userInterestCounts = await prisma.userInterest.groupBy({
      by: ['userId'],
      _count: {
        interestId: true
      },
      where: {
        interestId: {
          in: interestIds
        }
      }
    });

    console.log(`📊 ${userInterestCounts.length} users have the specified interests`);
    
    // Get sample data
    const sampleUserInterests = await prisma.userInterest.findMany({
      where: {
        interestId: {
          in: interestIds
        }
      },
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        },
        interest: {
          select: {
            name: true
          }
        }
      },
      take: 10
    });

    if (sampleUserInterests.length > 0) {
      console.log('\n📋 Sample user interests:');
      sampleUserInterests.forEach((userInterest, index) => {
        console.log(`   ${index + 1}. ${userInterest.user.email || userInterest.user.name} -> ${userInterest.interest.name}`);
      });
    }

  } catch (error: any) {
    console.error('❌ Error verifying user interests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
if (require.main === module) {
  console.log('🎯 Adding Interests to All Users');
  console.log('=================================');
  console.log('');
  
  addInterestsToAllUsers()
    .then(() => verifyUserInterests())
    .catch(console.error);
}

export { addInterestsToAllUsers, verifyUserInterests };