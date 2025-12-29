export default interface IFreeIpApiResponse {
  ipVersion: number;
  ipAddress: string;
  latitude: number;
  longitude: number;
  countryName: string;
  countryCode: string;
  timeZone: string;
  zipCode: string;
  cityName: string;
  regionName: string;
  continent: string;
  continentCode: string;
  isProxy: boolean;
  currency: Currency;
  language: string;
  timeZones: string[];
  tlds: string[];
}

export interface Currency {
  code: string;
  name: string;
}
