import IPost from "@/interfaces/IPost";

/**
 * Mobile app promotion message interface
 */
export interface MobileAppPromotion {
  title: string;
  message: string;
  features: string[];
  downloadLinks: {
    android: {
      url: string;
      label: string;
      icon: string;
    };
    ios: {
      url: string;
      label: string;
      icon: string;
    };
  };
  cta: string;
  disclaimer: string;
  postInfo: {
    title: string;
    prestige: string | null;
    price: string | null;
  };
  timestamp: string;
}

/**
 * Generate mobile app promotion message for paid articles
 * @param post - The post object
 * @returns Mobile app promotion object with message and download links
 */
export function generateMobileAppPromotionMessage(post: IPost): MobileAppPromotion {
  return {
    title: "Connectez-vous à l'app EcoMatin pour accéder gratuitement à ce contenu",
    message: "Suivez l'économie africaine où que vous soyez",
    features: [],
    downloadLinks: {
      android: {
        url: "https://play.google.com/store/apps/details?id=com.ecomatin.ecomatinMobileApp",
        label: "Google Play",
        icon: "🤖"
      },
      ios: {
        url: "https://apps.apple.com/cm/app/ecomatin/id6741209476?l=en-GB",
        label: "App Store",
        icon: "🍎"
      }
    },
    cta: "Télécharger EcoMatin",
    disclaimer: "Votre veille économique africaine en poche",
    postInfo: {
      title: post.title || "",
      prestige: post.postPrestige || null,
      price: post.price || null
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Check if mobile app promotion should be shown for a post
 * @param post - The post object
 * @returns True if promotion should be shown
 */
export function shouldShowMobileAppPromotion(post: IPost): boolean {
  return (
    ["ecomembre", "premium"].includes(post.postPrestige ?? "") ||
    (!!post.price && Number(post.price) > 0)
  );
}