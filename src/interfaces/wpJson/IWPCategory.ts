export default interface IWPCategory {
  id: number;
  count?: number;
  description?: string;
  link: string;
  name: string;
  slug: string;
  taxonomy: string;
  parent?: number;
  meta?: any[];
  _links: Links;
}

export interface Links {
  self: Self[];
  collection: Collection[];
  about: About[];
  "wp:post_type": WpPostType[];
  curies: Cury[];
  up?: Up[];
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

export interface Up {
  embeddable: boolean;
  href: string;
}
