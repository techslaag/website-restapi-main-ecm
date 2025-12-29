import IFreeIpApiResponse from "@/interfaces/IFreeIpApiResponse";
import { IpLookupBackup } from "@prisma/client";
import { captureException } from "@sentry/nextjs";
import prisma from "../prisma";

export default async function getCountryByIp(
  ip?: string,
): Promise<IpLookupBackup | null> {
  // default value
  const defaultValue: IpLookupBackup = {
    id: "ip",
    countryAlpha2Code: "be",
    countryName: "Belgium",
    currencyCode: "eur",
    ipAddress: "::1",
    isProxy: false,
    timeZones: "Europe/Brussels",
    createdAt: new Date(),
  };

  // ip defined
  if (ip && ip !== "::1") {
    // locale cache verification
    let backup = await prisma.ipLookupBackup.findUnique({
      where: { ipAddress: ip },
    });

    if (backup) {
      return backup;
    } else {
      const result = await fetch(
        `${process.env.FREEIPAPI_API_URL}/api/json/${ip}`,
        {
          cache: "no-cache",
        },
      )
        .then(async (response) => {
          const json = await response.json();
          if (response.ok) {
            return json as IFreeIpApiResponse;
          } else {
            throw json;
          }
        })
        .catch((err) => {
          captureException(err);
          return null;
        });

      if (result) {
        console.log("[getCountryByIp] API Response:", JSON.stringify(result, null, 2));
        
        // create a backup
        return await prisma.ipLookupBackup.create({
          data: {
            ipAddress: ip,
            countryAlpha2Code: result.countryCode || "cm",
            currencyCode: result.currency?.code || "xaf",
            countryName: result.countryName || "Cameroon",
            isProxy: result.isProxy || false,
            timeZones: result.timeZones?.[0] || "Africa/Douala",
          },
        });
      } else {
        console.log("[getCountryByIp] API call failed, using default");
        // default value
        return defaultValue;
      }
    }
  } else {
    return defaultValue;
  }
}
