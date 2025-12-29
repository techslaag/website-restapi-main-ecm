import IPostPersonnality from "@/interfaces/IPostPersonnality";
import IProduct from "@/interfaces/IProduct";
import IPackage from "@/interfaces/IPackageFw";

export function parsePostPersonnality(input: any): IPostPersonnality {
  if (!input || !input.ID) {
    throw new Error('Invalid personality input: missing ID');
  }
  
  const meta = input.meta || [];
  
  return {
    id: input.ID,
    nameTitle: input.post_title || "",
    firstName: meta.find(
      (m: { meta_key: string }) => m.meta_key === "first_name",
    )?.meta_value || "",
    lastName: meta.find(
      (m: { meta_key: string }) => m.meta_key === "last_name",
    )?.meta_value || "",
    usualName: meta.find(
      (m: { meta_key: string }) => m.meta_key === "usual_name",
    )?.meta_value || "",
    bio: meta.find((m: { meta_key: string }) => m.meta_key === "bio")
      ?.meta_value || "",
    website: meta.find(
      (m: { meta_key: string }) => m.meta_key === "website",
    )?.meta_value || "",
    email: meta.find((m: { meta_key: string }) => m.meta_key === "email")
      ?.meta_value || "",
    facebook: meta.find(
      (m: { meta_key: string }) => m.meta_key === "facebook",
    )?.meta_value || "",
    linkedin: meta.find(
      (m: { meta_key: string }) => m.meta_key === "linkedin",
    )?.meta_value || "",
    twitter: meta.find(
      (m: { meta_key: string }) => m.meta_key === "twitter",
    )?.meta_value || "",
    avatarId: meta.find(
      (m: { meta_key: string }) => m.meta_key === "avatar",
    )?.meta_value || "",
    avatarUrl: "",
  };
}

export function parseUpdateAvatarPostPersonnality(
  input: IPostPersonnality,
  url: string,
): IPostPersonnality {
  input.avatarUrl = url || "";
  return input;
}

export function parseProduct(input: any): IProduct {
  return {
    id: input.ID,
    name: input.post_title,
    description: input.post_excerpt,
    post_content: input.post_content || "",
    publicationDate: input.meta.find(
      (m: { meta_key: string }) => m.meta_key === "publication_date",
    )?.meta_value,
    productType: input.meta.find(
      (m: { meta_key: string }) => m.meta_key === "product_type",
    )?.meta_value,
    coverId: input.meta.find(
      (m: { meta_key: string }) => m.meta_key === "cover_image",
    )?.meta_value,
    fileContentId: input.meta.find(
      (m: { meta_key: string }) => m.meta_key === "pdf_file",
    )?.meta_value,
    currency:
      input.meta.find((m: { meta_key: string }) => m.meta_key === "currency")
        ?.meta_value ?? "EUR",
    integrationMode: input.meta.find(
      (m: { meta_key: string }) => m.meta_key === "integration_mode",
    )?.meta_value,
    iframe: input.meta.find(
      (m: { meta_key: string }) => m.meta_key === "iframe",
    )?.meta_value,
    iframePreview: input.meta.find(
      (m: { meta_key: string }) => m.meta_key === "iframe_preview",
    )?.meta_value,
    link: input.meta.find((m: { meta_key: string }) => m.meta_key === "link")
      ?.meta_value,
    linkPreview: input.meta.find(
      (m: { meta_key: string }) => m.meta_key === "link_preview",
    )?.meta_value,
    publicationNumber: input.meta.find(
      (m: { meta_key: string }) => m.meta_key === "publication_number",
    )?.meta_value,
    price: input.meta.find((m: { meta_key: string }) => m.meta_key === "price")
      ?.meta_value,
    coverUrl: "",
    fileContentUrl: "",
  };
}

export function parsePackageFw(input: any): IPackage {
  return {
    id: input.ID,
    name: input.post_title,
    description: input.post_excerpt,
    currency:
      input.meta.find((m: { meta_key: string }) => m.meta_key === "currency")
        ?.meta_value ?? "EUR",
    price: input.meta.find((m: { meta_key: string }) => m.meta_key === "price")
      ?.meta_value,
    archivedAt: input.meta.find(
      (m: { meta_key: string }) => m.meta_key === "archivedat",
    )?.meta_value,
  };
}

export function parseUpdateCover(input: IProduct, cover_url: string): IProduct {
  input.coverUrl = cover_url;
  return input;
}

export function parseUpdateCovernFileProduct(
  input: IProduct,
  cover_url: string,
  file_url: string,
): IProduct {
  input.coverUrl = cover_url;
  input.fileContentUrl = file_url;
  return input;
}
