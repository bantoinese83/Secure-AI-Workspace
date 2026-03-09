/**
 * AWS Amplify configuration for Cognito authentication.
 * Configure via environment variables - all AWS infrastructure is pre-set up.
 */
import { Amplify } from "aws-amplify";

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
const identityPoolId = process.env.NEXT_PUBLIC_IDENTITY_POOL_ID ?? "";

export function configureAmplify() {
  if (typeof window !== "undefined" && userPoolId) {
    Amplify.configure(
      {
        Auth: {
          Cognito: {
            userPoolId,
            userPoolClientId,
            ...(identityPoolId && { identityPoolId }),
          },
        },
      } as Parameters<typeof Amplify.configure>[0],
      { ssr: true }
    );
  }
}

export const isAuthConfigured = () => Boolean(userPoolId && userPoolClientId);
