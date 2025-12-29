export interface IPolygonIOGroupedResponse {
    queryCount: number
    resultsCount: number
    adjusted: boolean
    status: string
    results: IPolygonIOGroupedItem[]
    request_id: string
    count: number
}

export interface IPolygonIOGroupedItem {
    T: string
    v: number
    vw: number
    o: number
    c: number
    h: number
    l: number
    t: number
    n: number
}
