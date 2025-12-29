import { serializeError } from "serialize-error";

interface JobsResponse {
  jobs: Job[];
  someFailed: boolean;
}

interface Job {
  jobId: number;
  enabled: boolean;
  title: string;
  saveResponses: boolean;
  url: string;
  lastStatus: number;
  lastDuration: number;
  lastExecution: number;
  nextExecution: number;
  type: number;
  requestTimeout: number;
  redirectSuccess: boolean;
  folderId: number;
  schedule: Schedule;
  requestMethod: number;
}

interface JobDetails extends Job {
  auth: Auth;
  notification: Notification;
  extendedData: ExtendedData;
}

interface Auth {
  enable: boolean;
  user: string;
  password: string;
}

interface Notification {
  onFailure: boolean;
  onSuccess: boolean;
  onDisable: boolean;
}

interface ExtendedData {
  headers: Record<string, string>;
  body: string;
}

interface Schedule {
  timezone: string;
  expiresAt: number;
  hours: number[];
  mdays: number[];
  minutes: number[];
  months: number[];
  wdays: number[];
}

export interface JobCreatePayload {
  job: JobCreateData;
}

export interface JobCreateData {
  url: string;
  enabled: boolean;
  saveResponses: boolean;
  schedule: Schedule;
  notification: { onFailure: boolean; onSuccess: boolean; onDisable: boolean };
  extendedData: {
    headers: { [key: string]: string };
  };
}

function getFlutterwaveCronJobUrlUrl() {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/flutterwave/trans-verif`;
}

async function fetchJobs() {
  return await fetch(`${process.env.CRON_JOB_API_URL}/jobs`, {
    headers: {
      Authorization: `Bearer ${process.env.CRON_JOB_API_KEY}`,
      "Content-Type": "application/json",
    },
  })
    .then(async (res) => {
      if (res.ok) {
        return (await res.json()) as JobsResponse;
      } else {
        return null;
      }
    })
    .catch(() => null);
}

export async function syncFlutterwaveCronJob() {
  try {
    if (process.env.NODE_ENV === "production") {
      const cronUrl = getFlutterwaveCronJobUrlUrl();
      // headers
      const _HEADER_SECRET = {
        "x-secret": process.env.CRON_JOB_HEADER_SECRET,
      } as const;

      // fetch existing job
      const jobsResponse = await fetchJobs();

      if (jobsResponse) {
        // cron already exists
        let existingJob = await jobsResponse.jobs.find(
          (job) => job.url === cronUrl,
        );

        if (existingJob) {
          // fetch the job details
          const jobDetails = await fetch(
            `${process.env.CRON_JOB_API_URL}/jobs/${existingJob.jobId}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.CRON_JOB_API_KEY}`,
                "Content-Type": "application/json",
              },
            },
          )
            .then(async (res) => {
              if (res.ok) {
                const json = (await res.json()) as {
                  jobDetails: JobDetails;
                };

                return json.jobDetails;
              } else {
                return null;
              }
            })
            .catch(() => null);

          // in case the secret value has change in the env
          if (
            jobDetails &&
            jobDetails.extendedData.headers["x-secret"] !==
              _HEADER_SECRET["x-secret"]
          ) {
            // delete the job
            await fetch(
              `${process.env.CRON_JOB_API_URL}/jobs/${existingJob.jobId}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${process.env.CRON_JOB_API_KEY}`,
                  "Content-Type": "application/json",
                },
              },
            ).then((res) => {
              if (res.ok) {
                existingJob = undefined;
              }
            });
          }
        }

        // job doesn't exists
        if (!existingJob) {
          await fetch(`${process.env.CRON_JOB_API_URL}/jobs`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${process.env.CRON_JOB_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              job: {
                url: cronUrl,
                enabled: true,
                requestMethod: 0,
                notification: {
                  onFailure: false,
                  onSuccess: false,
                  onDisable: false,
                },
                schedule: {
                  timezone: "Europe/Berlin",
                  expiresAt: 0,
                  hours: [-1],
                  mdays: [-1],
                  minutes: [-1],
                  months: [-1],
                  wdays: [-1],
                },
                saveResponses: false,
                extendedData: {
                  headers: {
                    ..._HEADER_SECRET,
                  },
                },
              },
            } as JobCreatePayload),
          })
            .then(async (res) => {
              if (res.ok) {
                return (await res.json()) as {
                  jobId: number;
                };
              } else {
                return null;
              }
            })
            .catch(() => null);
        }
      }
    }
  } catch (error) {
    // send the error to sentry
    // no action needed as the cron can be created manually
    console.error("syncFlutterwaveCronJob error:", serializeError(error));
  }
}
