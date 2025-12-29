import mailchimp from "@mailchimp/mailchimp_marketing";
// const mailchimp = require('@mailchimp/mailchimp_marketing');

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX,
});

export function isMailchimpErrorResponse(response: any) {
  return !!response && (
    Object.keys(response).includes("status") &&
    Object.keys(response).includes("detail")
  );
}

export default mailchimp;
