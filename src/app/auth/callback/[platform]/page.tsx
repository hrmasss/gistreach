"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import { SocialPlatform } from "@/server/services/auth/base-auth-provider";

interface OAuthCallbackProps {
  params: Promise<{
    platform: string;
  }>;
}

export default function OAuthCallback({ params }: OAuthCallbackProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [platform, setPlatform] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const initializeCallback = async () => {
      const resolvedParams = await params;
      setPlatform(resolvedParams.platform);
    };
    initializeCallback();
  }, [params]);

  const handleCallback = api.socialAuth.handleCallback.useMutation({
    onSuccess: (result) => {
      setStatus("success");
      // Redirect back to the workspace after a short delay
      setTimeout(() => {
        router.push("/"); // Or redirect to the specific workspace
      }, 2000);
    },
    onError: (error) => {
      setStatus("error");
      setError(error.message);
    }
  });

  useEffect(() => {
    if (!platform) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      setStatus("error");
      setError(errorDescription || error);
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setError("Missing authorization code or state parameter");
      return;
    }

    // Validate platform
    const validPlatforms = Object.values(SocialPlatform);
    if (!validPlatforms.includes(platform as SocialPlatform)) {
      setStatus("error");
      setError("Invalid platform");
      return;
    }

    // Handle the callback
    const redirectUri = `${window.location.origin}/auth/callback/${platform}`;

    handleCallback.mutate({
      platform: platform as SocialPlatform,
      code,
      state,
      redirectUri
    });
  }, [platform, searchParams, handleCallback]);

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return "Facebook";
      case SocialPlatform.X:
        return "X (Twitter)";
      case SocialPlatform.LINKEDIN:
        return "LinkedIn";
      default:
        return platform;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return "📘";
      case SocialPlatform.X:
        return "🐦";
      case SocialPlatform.LINKEDIN:
        return "💼";
      default:
        return "🔗";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          {status === "loading" && (
            <>
              <div className="text-4xl mb-4">{getPlatformIcon(platform)}</div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connecting {getPlatformName(platform)}
              </h2>
              <p className="text-gray-600">
                Please wait while we complete the connection...
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-xl font-semibold text-green-900 mb-2">
                Successfully Connected!
              </h2>
              <p className="text-green-700 mb-4">
                Your {getPlatformName(platform)} account has been connected successfully.
              </p>
              <p className="text-sm text-gray-600">
                Redirecting you back to the dashboard...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-4xl mb-4">❌</div>
              <h2 className="text-xl font-semibold text-red-900 mb-2">
                Connection Failed
              </h2>
              <p className="text-red-700 mb-4">
                Failed to connect your {getPlatformName(platform)} account.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => router.push("/")}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Back to Dashboard
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}