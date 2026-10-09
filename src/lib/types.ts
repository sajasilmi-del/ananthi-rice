export type Locale = "ta" | "en";

export type BrandId = "ananthi" | "arthy" | "santosh" | "mahi";
export type BrandRole = "main" | "sub";
export type CategoryId =
  | "everyday"
  | "biryani"
  | "hand-pounded"
  | "traditional"
  | "sevai"
  | "millets"
  | "flour";

export type Variant = {
  id: string;
  packSize: string | null;
  packSizeTamil: string | null;
  price: number | null;
  salePrice: number | null;
  stock: number | null;
};

export type Product = {
  id: string;
  brand: BrandId;
  category: CategoryId;
  nameTamil: string;
  nameEnglish: string;
  descriptionTamil: string;
  descriptionEnglish: string;
  images: string[];
  variants: Variant[];
  featured: boolean;
  active: boolean;
};

export type Brand = {
  id: BrandId;
  role: BrandRole;
  nameEnglish: string;
  nameTamil: string;
  productLine: string;
  taglineEnglish: string;
  descriptionTamil: string;
  descriptionEnglish: string;
  logo: string;
};

export type Category = {
  id: CategoryId;
  nameTamil: string;
  nameEnglish: string;
  descriptionTamil: string;
  descriptionEnglish: string;
  image: string;
};

export type LocationRecord = {
  id: string;
  role: "head_office_direct_sales" | "branch_office";
  businessName: string;
  nameTamil: string;
  nameEnglish: string;
  addressTamil: string[];
  addressEnglish: string[];
  latitude: number | null;
  longitude: number | null;
  /** Google Maps place link. Directions open this listing when it is set. */
  mapUrl?: string;
  /** Google Maps customer id. Kept as a string so the value is not rounded. */
  mapCid?: string;
};

export type FaqItem = {
  id: string;
  questionTamil: string;
  questionEnglish: string;
  answerTamil: string;
  answerEnglish: string;
};

export type LegalPage = {
  id: "privacy" | "terms" | "delivery" | "returns";
  titleTamil: string;
  titleEnglish: string;
  bodyTamil: string[];
  bodyEnglish: string[];
};

export type DeliveryConfig = {
  enabled: boolean;
  radiusKm: number;
  origin: {
    latitude: number | null;
    longitude: number | null;
  };
  feeWhenAvailableInr: number | null;
  notes?: string;
};

export type SiteConfig = {
  brandName: string;
  legalName: string;
  contactPerson: string;
  contactPersonTamil: string;
  yearsOfTrade: number;
  taglineTamil: string;
  taglineEnglish: string;
  heroTamil: string;
  heroEnglish: string;
  aboutTamil: string;
  aboutEnglish: string;
  phones: string[];
  whatsappE164: string;
  email: string;
  website: string;
  fssai: {
    registrationNumber: string;
    licenseeEnglish: string;
    licenseeTamil: string;
    kindEnglish: string;
    kindTamil: string;
    issuedOn: string;
    validUntil: string;
    lookupUrl: string;
  };
  gst: {
    gstin: string;
    legalName: string;
    tradeName: string;
    principalAddress: string;
    constitution: string;
    registrationType: string;
    state: string;
    stateTamil: string;
    stateCode: string;
  };
  freeDeliveryTamil: string;
  freeDeliveryEnglish: string;
};

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type ConfirmedLocation = LatLng & {
  source: "browser" | "map" | "address";
  addressLabel: string;
  confirmedAt: string;
};

/** A Chennai or Paramakudi pincode the shop can deliver to. Coordinates are not part of this check. */
export type ConfirmedServiceArea = {
  source: "pincode";
  pincode: string;
  areasEnglish: string;
  areasTamil: string;
  addressLabel: string;
  confirmedAt: string;
};

export type CartLine = {
  productId: string;
  variantId: string;
  quantity: number;
};
