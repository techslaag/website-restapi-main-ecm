import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export class Password {
  /**
   * Hash the user password.
   * The password and its salf concatenated using the format 'pwdHash.salt'.
   *
   * @param password user password
   * @returns hashed password
   */
  static async hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = scryptSync(password, salt, 64);
    return `${buf.toString("hex")}.${salt}`;
  }

  /**
   * Compare the supplied password to the one saved in the database
   *
   * @param storedPassword user's stored password
   * @param suppliedPassword given password
   * @returns boolean
   */
  static async comparePassword(
    storedPassword: string,
    suppliedPassword: string
  ): Promise<boolean> {
    // split() returns array
    const [hashedPassword, salt] = storedPassword.split(".");
    // we need to pass buffer values to timingSafeEqual
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    // we hash the new sign-in password
    const suppliedPasswordBuf = scryptSync(suppliedPassword, salt, 64);
    // compare the new supplied password with the stored hashed password
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  }
}
