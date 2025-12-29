export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // extract search params
  const searchParams = new URL(req.url).searchParams;

  try {
    const apiUrl = new URL(
      `${process.env.POLYGON_IO_API_BASE_URL}/v3/reference/tickers`,
    );
    apiUrl.searchParams.set("active", "true");
    apiUrl.searchParams.set("order", "asc");
    apiUrl.searchParams.set("sort", "ticker");
    apiUrl.searchParams.set(
      "limit",
      Number(searchParams.get("limit") ?? 100).toString(),
    );
    apiUrl.searchParams.set("apiKey", process.env.POLYGON_IO_API_KEY!);

    const response = await fetch(apiUrl.toString(), {
      cache: "force-cache",
      next: {
        revalidate: 24 * 3600,
      },
    }).then(async (res) => await res.json());

    return Response.json({
      success: true,
      data: response,
    });
  } catch (error) {
    return Response.json({
      success: false,
      data: null,
      error: JSON.parse(JSON.stringify(error ?? {})),
    });
  }
}
