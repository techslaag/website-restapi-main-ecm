import { NextRequest, NextResponse } from "next/server";
import { toIPost } from "@/interfaces/IPost";
import {
  getPaginationMetaData,
  injectFeaturedImages,
} from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ term: string }> },
) {
  try {
    const { term } = await params;
    const queryParams = extractQueryParams(req);

    if (!term) {
      return NextResponse.json(
        { error: "No search term provided" },
        { status: 400 }
      );
    }

    // Decode and sanitize search term
    const searchTerm = decodeURIComponent(term).trim();
    
    if (searchTerm.length < 2) {
      return NextResponse.json(
        { error: "Search term must be at least 2 characters long" },
        { status: 400 }
      );
    }

    const page = Math.max(1, Number(queryParams.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(queryParams.limit ?? 10)));

    // MySQL uses case-insensitive search by default for utf8mb4_unicode_ci collation
    const whereQuery: Prisma.mod180_postsWhereInput = {
      post_type: "post",
      post_status: "publish",
      OR: [
        {
          post_name: {
            contains: searchTerm,
          },
        },
        {
          post_excerpt: {
            contains: searchTerm,
          },
        },
        {
          post_title: {
            contains: searchTerm,
          },
        },
        {
          post_content: {
            contains: searchTerm,
          },
        },
      ],
    };

    const paginationMeta = await getPaginationMetaData(
      "mod180_posts",
      page,
      limit,
      whereQuery,
    );

    // Optimize query with selected fields and relationships
    const posts = await prisma.mod180_posts.findMany({
      where: whereQuery,
      ...paginationMeta.query,
      orderBy: {
        post_date_gmt: "desc",
      },
      select: {
        ID: true,
        post_name: true,
        post_status: true,
        post_excerpt: true,
        post_title: true,
        post_date: true,
        post_date_gmt: true,
        post_modified: true,
        post_modified_gmt: true,
        meta: {
          where: {
            meta_key: {
              in: ["_thumbnail_id", "_views_count"], // Only fetch necessary meta
            },
          },
          select: {
            meta_key: true,
            meta_value: true,
          },
        },
        termRelationships: {
          select: {
            taxonomy: {
              select: {
                taxonomy: true,
                count: true,
                description: true,
                term: {
                  select: {
                    term_id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        children: {
          where: {
            post_type: "attachment",
            post_mime_type: {
              startsWith: "image/",
            },
          },
          take: 1, // Limit to first image attachment
          orderBy: {
            menu_order: "asc",
          },
          select: {
            ID: true,
            guid: true,
            post_type: true,
            post_excerpt: true,
            post_mime_type: true,
            post_title: true,
            post_date: true,
            meta: {
              where: {
                meta_key: {
                  in: ["_wp_attachment_metadata", "_wp_attached_file"],
                },
              },
              select: {
                meta_key: true,
                meta_value: true,
              },
            },
          },
        },
        author: {
          select: {
            ID: true,
            display_name: true,
            user_nicename: true,
          },
        },
      },
    });

    const postsWithFeaturedImages = await injectFeaturedImages(
      posts.map((item) => toIPost(item as any)),
    );

    // Return paginated response with metadata
    return NextResponse.json({
      posts: toSafeJSON(postsWithFeaturedImages),
      pagination: {
        currentPage: paginationMeta.meta.page,
        totalPages: paginationMeta.meta.totalPages,
        totalItems: paginationMeta.meta.total,
        itemsPerPage: paginationMeta.meta.limit,
        hasNextPage: paginationMeta.meta.page < paginationMeta.meta.totalPages,
        hasPreviousPage: paginationMeta.meta.page > 1,
      },
      searchTerm: searchTerm,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    
    // Check if it's a database connection error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes("Can't reach database server")) {
      // Return mock data to demonstrate the API structure
      return NextResponse.json({
        posts: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        searchTerm: decodeURIComponent(await params.then(p => p.term)),
        error: "Database connection failed",
        message: "Unable to connect to database. API structure shown with empty data.",
      }, { 
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': '30'
        }
      });
    }
    
    return NextResponse.json(
      {
        error: "An error occurred while searching",
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
