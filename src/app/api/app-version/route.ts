/**
 * @swagger
 * /app-version:
 *   get:
 *     summary: Get current app version information
 *     description: Returns the latest app version information for mobile apps
 *     operationId: getAppVersion
 *     tags:
 *       - App Version
 *     responses:
 *       '200':
 *         description: Version information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 latestVersion:
 *                   type: string
 *                   description: Latest available version
 *                   example: "1.4.0"
 *                 minimumVersion:
 *                   type: string
 *                   description: Minimum required version (force update if below this)
 *                   example: "1.3.0"
 *                 forceUpdate:
 *                   type: boolean
 *                   description: Whether to force users to update
 *                   example: false
 *                 updateMessage:
 *                   type: string
 *                   description: Custom message to show to users
 *                   example: "New features and bug fixes available!"
 *                 iosUrl:
 *                   type: string
 *                   description: App Store URL for iOS
 *                   example: "https://apps.apple.com/app/id123456789"
 *                 androidUrl:
 *                   type: string
 *                   description: Play Store URL for Android
 *                   example: "https://play.google.com/store/apps/details?id=com.ecomatin.ecomatin"
 *       '500':
 *         description: Internal server error
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Version configuration
    // Update these values when releasing new versions
    const versionConfig = {
      latestVersion: "1.3.6", // Current latest version in stores
      minimumVersion: "1.3.6", // Minimum version required to use the app
      forceUpdate: true, // Set to true to force all users to update
      updateMessage:
        "Une nouvelle version est disponible avec des ameliorations et corrections de bugs.",
      iosUrl: "https://apps.apple.com/cm/app/ecomatin/id6741209476?l=en-GB", // Replace with actual App Store URL
      androidUrl:
        "https://play.google.com/store/apps/details?id=com.ecomatin.ecomatinMobileApp",

      // Alternative configurations for different scenarios:
      // When you want to force everyone to update:
      // forceUpdate: true,
      // updateMessage: "Une mise à jour critique est requise pour continuer à utiliser l'application."

      // When you have a critical bug fix:
      // minimumVersion: "1.3.4", // Everyone below 1.3.4 must update
      // forceUpdate: true,

      // When you have optional features:
      // forceUpdate: false,
      // updateMessage: "Découvrez nos nouvelles fonctionnalités !"
    };

    return Response.json(versionConfig, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Error in app-version endpoint:", error);
    return Response.json(
      {
        error: "Failed to retrieve version information",
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Optional: Add POST method to allow admins to update version config
// This would require authentication and database storage
/*
export async function POST(request: Request) {
  // Implement authentication check here
  // const user = await authenticateUser(request);
  // if (!user || !user.isAdmin) {
  //   return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const body = await request.json();

    // Validate the version config
    const { latestVersion, minimumVersion, forceUpdate, updateMessage, iosUrl, androidUrl } = body;

    // Store in database or update config file
    // await updateVersionConfig(body);

    return Response.json({
      success: true,
      message: 'Version config updated successfully',
      config: body
    });
  } catch (error) {
    console.error('Error updating version config:', error);
    return Response.json(
      { error: 'Failed to update version config' },
      { status: 500 }
    );
  }
}
*/
