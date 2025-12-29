import { mod180_posts } from "@prisma/client";

export default interface IPostMostViewed {
  id: string;
  date: Date;
  dateGmt: Date;
  modified: Date;
  modifiedGmt: Date;
  slug: string;
  status: string;
  title: string;
}

export function toIPostMostViewed(
  item: Pick<
    mod180_posts,
    | "ID"
    | "post_name"
    | "post_title"
    | "post_date_gmt"
    | "post_date"
    | "post_modified_gmt"
    | "post_modified"
    | "post_status"
  >,
): IPostMostViewed {
  return {
    id: item.ID.toString(),
    slug: item.post_name,
    status: item.post_status,
    title: item.post_title,
    date: item.post_date_gmt! || item.post_date!,
    dateGmt: item.post_date_gmt!,
    modified: item.post_modified_gmt! || item.post_modified!,
    modifiedGmt: item.post_modified_gmt!,
  };
}
