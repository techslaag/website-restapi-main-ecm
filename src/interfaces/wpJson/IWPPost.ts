export default interface IWPPost {
  id: number
  date: string
  date_gmt: string
  guid: Guid
  modified: string
  modified_gmt: string
  slug: string
  status: string
  type: string
  link: string
  title: Title
  content: Content
  excerpt: Excerpt
  author: number
  featured_media: number
  comment_status: string
  ping_status: string
  sticky: boolean
  template: string
  format: string
  meta: Meta
  categories: number[]
  tags: number[]
  _links: Links
  _embedded: Embedded
}

export interface Guid {
  rendered: string
}

export interface Title {
  rendered: string
}

export interface Content {
  rendered: string
  protected: boolean
}

export interface Excerpt {
  rendered: string
  protected: boolean
}

export interface Meta {
  footnotes: string
}

export interface Links {
  self: Self[]
  collection: Collection[]
  about: About[]
  author: Author[]
  replies: Reply[]
  "version-history": VersionHistory[]
  "predecessor-version": PredecessorVersion[]
  "wp:featuredmedia": Featuredmedum[]
  "wp:attachment": WpAttachment[]
  "wp:term": WpTerm[]
  curies: Cury[]
}

export interface Self {
  href: string
}

export interface Collection {
  href: string
}

export interface About {
  href: string
}

export interface Author {
  embeddable: boolean
  href: string
}

export interface Reply {
  embeddable: boolean
  href: string
}

export interface VersionHistory {
  count: number
  href: string
}

export interface PredecessorVersion {
  id: number
  href: string
}

export interface Featuredmedum {
  embeddable: boolean
  href: string
}

export interface WpAttachment {
  href: string
}

export interface WpTerm {
  taxonomy: string
  embeddable: boolean
  href: string
}

export interface Cury {
  name: string
  href: string
  templated: boolean
}

export interface Embedded {
  author: Author2[]
  "wp:featuredmedia": Featuredmedum2[]
  "wp:term": WpTerm2[][]
}

export interface Author2 {
  id: number
  name: string
  url: string
  description: string
  link: string
  slug: string
  avatar_urls: AvatarUrls
  _links: Links2
}

export interface AvatarUrls {
  "24": string
  "48": string
  "96": string
}

export interface Links2 {
  self: Self2[]
  collection: Collection2[]
}

export interface Self2 {
  href: string
}

export interface Collection2 {
  href: string
}

export interface Featuredmedum2 {
  id: number
  date: string
  slug: string
  type: string
  link: string
  title: Title2
  author: number
  caption: Caption
  alt_text: string
  media_type: string
  mime_type: string
  media_details: MediaDetails
  source_url: string
  _links: Links3
}

export interface Title2 {
  rendered: string
}

export interface Caption {
  rendered: string
}

export interface MediaDetails {
  width: number
  height: number
  file: string
  filesize: number
  sizes: Sizes
  image_meta: ImageMeta
}

export interface Sizes {
  medium: Medium
  large: Large
  thumbnail: Thumbnail
  medium_large: MediumLarge
  "jannah-image-small": JannahImageSmall
  "jannah-image-large": JannahImageLarge
  "jannah-image-post": JannahImagePost
  full: Full
}

export interface Medium {
  file: string
  width: number
  height: number
  filesize: number
  mime_type: string
  source_url: string
}

export interface Large {
  file: string
  width: number
  height: number
  filesize: number
  mime_type: string
  source_url: string
}

export interface Thumbnail {
  file: string
  width: number
  height: number
  filesize: number
  mime_type: string
  source_url: string
}

export interface MediumLarge {
  file: string
  width: number
  height: number
  filesize: number
  mime_type: string
  source_url: string
}

export interface JannahImageSmall {
  file: string
  width: number
  height: number
  filesize: number
  mime_type: string
  source_url: string
}

export interface JannahImageLarge {
  file: string
  width: number
  height: number
  filesize: number
  mime_type: string
  source_url: string
}

export interface JannahImagePost {
  file: string
  width: number
  height: number
  filesize: number
  mime_type: string
  source_url: string
}

export interface Full {
  file: string
  width: number
  height: number
  mime_type: string
  source_url: string
}

export interface ImageMeta {
  aperture: string
  credit: string
  camera: string
  caption: string
  created_timestamp: string
  copyright: string
  focal_length: string
  iso: string
  shutter_speed: string
  title: string
  orientation: string
  keywords: any[]
}

export interface Links3 {
  self: Self3[]
  collection: Collection3[]
  about: About2[]
  author: Author3[]
  replies: Reply2[]
}

export interface Self3 {
  href: string
}

export interface Collection3 {
  href: string
}

export interface About2 {
  href: string
}

export interface Author3 {
  embeddable: boolean
  href: string
}

export interface Reply2 {
  embeddable: boolean
  href: string
}

export interface WpTerm2 {
  id: number
  link: string
  name: string
  slug: string
  taxonomy: string
  _links: Links4
}

export interface Links4 {
  self: Self4[]
  collection: Collection4[]
  about: About3[]
  "wp:post_type": WpPostType[]
  curies: Cury2[]
}

export interface Self4 {
  href: string
}

export interface Collection4 {
  href: string
}

export interface About3 {
  href: string
}

export interface WpPostType {
  href: string
}

export interface Cury2 {
  name: string
  href: string
  templated: boolean
}
