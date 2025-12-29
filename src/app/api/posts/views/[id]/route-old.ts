import prisma from "@/lib/prisma";
import { extractQueryParams } from "@/lib/utils/index";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const queryParams = extractQueryParams(req);
    const post_id = Number(params.id);
    const post = await prisma.mod180_posts.findUnique({
        where: {
            ID: post_id,
            post_type: "post",
            post_status: "publish",
        },
        include: {
            meta: true,
        },
    });

    if(post == null) {
        return Response.json(
            {
                error: `Post of ID ${post_id} not found`
            },
            {
                status: 404
            }
        )
    }

    const formattedResponse = JSON.parse(
        JSON.stringify(
            post,
            (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
        )
    )

    const views = formattedResponse.meta.find((m: { meta_key: string; }) => m.meta_key === 'tie_views')?.meta_value

    return Response.json({
        id: post_id,
        view_count: views
    })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const queryParams = extractQueryParams(req);
    const post_id = Number(params.id);

    if(queryParams.action) {
        if(queryParams.action === "increment" || queryParams.action === "decrement") {

            const post = await prisma.mod180_posts.findUnique({
                where: {
                    ID: post_id,
                    post_type: "post",
                    post_status: "publish",
                },
                include: {
                    meta: true,
                },
            });

            if(post == null) {
                return Response.json(
                    {
                        error: `Cannot PUT unresolved post : Post of ID ${post_id} not found`
                    },
                    {
                        status: 404
                    }
                )
            }

            const formattedResponse = JSON.parse(
                JSON.stringify(
                    post,
                    (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
                )
            )

            const views = formattedResponse.meta.find((m: { meta_key: string; }) => m.meta_key === 'tie_views')?.meta_value

            await prisma.mod180_postmeta.update({
                where: {
                    meta_id: formattedResponse.meta.find((m: { meta_key: string; }) => m.meta_key === 'tie_views')?.meta_id
                },
                data: {
                    meta_value: queryParams.action === "increment" ? (views+1) : queryParams.action === "decrement" && (views-1),
                }
            })


        } else {
            return Response.json(
                {
                    error: "Invalid action"
                },
                {
                    status: 400
                }
            )
        }
    } else {
        return Response.json(
            {
                error: "Missing action"
            },
            {
                status: 400
            }
        )
    }
}