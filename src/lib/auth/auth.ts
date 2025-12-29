import { User } from "@prisma/client";
import { sign } from "jsonwebtoken";
import moment from "moment";
import prisma from "../prisma";
import { detectDeviceType } from "../utils/deviceUtils";
import {
  canCreateSession,
  cleanupOldSessionsForDeviceType,
  cleanupOldestSession,
} from "../utils/sessionUtils";

export async function generateUserToken(
  user: User,
  clientInfo: { userAgent: string; idAddress: string },
) {
  // detect device type from user agent
  const deviceType = detectDeviceType(clientInfo.userAgent);

  // check if user can create a session for this device type
  const sessionCheck = await canCreateSession(user.id, deviceType);

  if (!sessionCheck.canCreate) {
    // Clean up old sessions to make room for the new one
    await cleanupOldSessionsForDeviceType(user.id, deviceType);
    await cleanupOldestSession(user.id);
  }

  // generate access token
  const accessToken = sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET!,
    {
      subject: user.id,
      expiresIn: process.env.NODE_ENV !== "production" ? "730h" : "24h",
    },
  );

  // create a new session
  const session = await prisma.session.create({
    data: {
      expires: moment().add(1, "day").toDate(),
      sessionToken: accessToken,
      userAgent: clientInfo.userAgent,
      userIpAddress: clientInfo.idAddress,
      deviceType: deviceType,
      userId: user.id,
    },
  });

  return session;
}
