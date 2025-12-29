export default interface IWPTag {
  id: number;
  count?: number;
  description?: string;
  link: string;
  name: string;
  slug: string;
  taxonomy: string;
  meta?: any[];
  _links: Links;
}

export interface Links {
  self: Self[];
  collection: Collection[];
  about: About[];
  "wp:post_type": WpPostType[];
  curies: Cury[];
}

export interface Self {
  href: string;
}

export interface Collection {
  href: string;
}

export interface About {
  href: string;
}

export interface WpPostType {
  href: string;
}

export interface Cury {
  name: string;
  href: string;
  templated: boolean;
}
