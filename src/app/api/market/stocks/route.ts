export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const apiUrl = new URL(
      `${process.env.POLYGON_IO_API_BASE_URL}/v2/aggs/grouped/locale/us/market/stocks/2024-12-09`
    );
    apiUrl.searchParams.set("adjusted", "true");
    apiUrl.searchParams.set("apiKey", process.env.POLYGON_IO_API_KEY!);

    const response = await fetch(apiUrl.toString(), {
      // next: {
      //   revalidate: 24 * 3600,
      // },
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
