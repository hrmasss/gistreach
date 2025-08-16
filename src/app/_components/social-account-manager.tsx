"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { SocialPlatform, AccountType } from "@/server/services/auth/base-auth-provider";

interface SocialAccountManagerProps {
  workspaceId: string;
}

export function SocialAccountManager({ workspaceId }: SocialAccountManagerProps) {
  const [isConnecting, setIsConnecting] = useState<SocialPlatform | null>(null);

  const utils = api.useUtils();

  const { data: accounts, isLoading } = api.credential.getWorkspaceAccounts.useQuery({ workspaceId });
  const { data: availablePlatforms } = api.socialAuth.getAvailablePlatforms.useQuery();

  const initiateAuth = api.socialAuth.initiateAuth.useMutation({
    onSuccess: (result) => {
      // Redirect to OAuth URL
      window.location.href = result.url;
    },
    onError: (error) => {
      console.error("Failed to initiate auth:", error);
      setIsConnecting(null);
    }
  });

  const revokeAccess = api.socialAuth.revokeAccess.useMutation({
    onSuccess: () => {
      utils.credential.getWorkspaceAccounts.invalidate({ workspaceId });
    },
    onError: (error) => {
      console.error("Failed to revoke access:", error);
    }
  });

  const handleConnect = async (platform: SocialPlatform) => {
    setIsConnecting(platform);

    const redirectUri = `${window.location.origin}/auth/callback/${platform}`;

    try {
      await initiateAuth.mutateAsync({
        workspaceId,
        platform,
        accountType: AccountType.PERSONAL, // Default to personal, can be made configurable
        redirectUri
      });
    } catch (error) {
      setIsConnecting(null);
    }
  };

  const handleDisconnect = async (accountId: string, platform: SocialPlatform) => {
    if (confirm("Are you sure you want to disconnect this account? You'll lose access to posting and analytics.")) {
      await revokeAccess.mutateAsync({
        accountId,
        platform
      });
    }
  };

  const getPlatformIcon = (platform: SocialPlatform) => {
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

  const getPlatformName = (platform: SocialPlatform) => {
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

  const getPlatformColor = (platform: SocialPlatform) => {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return "bg-blue-600 hover:bg-blue-700";
      case SocialPlatform.X:
        return "bg-black hover:bg-gray-800";
      case SocialPlatform.LINKEDIN:
        return "bg-blue-700 hover:bg-blue-800";
      default:
        return "bg-gray-600 hover:bg-gray-700";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const connectedPlatforms = new Set(accounts?.map(account => account.platform) || []);
  const availableToConnect = availablePlatforms?.filter(platform => !connectedPlatforms.has(platform)) || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Social Media Accounts</h2>
        <p className="text-gray-600">Connect your social media accounts to start publishing content</p>
      </div>

      {/* Connected Accounts */}
      {accounts && accounts.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Connected Accounts</h3>
          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="text-2xl">
                    {getPlatformIcon(account.platform as SocialPlatform)}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{account.displayName}</h4>
                    <p className="text-sm text-gray-600">
                      {getPlatformName(account.platform as SocialPlatform)} •
                      Connected {new Date(account.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {account.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleDisconnect(account.id, account.platform as SocialPlatform)}
                    disabled={revokeAccess.isPending}
                    className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                  >
                    {revokeAccess.isPending ? "Disconnecting..." : "Disconnect"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available to Connect */}
      {availableToConnect.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {accounts && accounts.length > 0 ? "Connect More Accounts" : "Connect Your First Account"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableToConnect.map((platform) => (
              <button
                key={platform}
                onClick={() => handleConnect(platform)}
                disabled={isConnecting === platform || initiateAuth.isPending}
                className={`flex items-center justify-center space-x-3 p-4 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getPlatformColor(platform)}`}
              >
                <span className="text-xl">{getPlatformIcon(platform)}</span>
                <span>
                  {isConnecting === platform ? "Connecting..." : `Connect ${getPlatformName(platform)}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!accounts || accounts.length === 0) && availableToConnect.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔗</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Social Accounts Available</h3>
          <p className="text-gray-600">
            Social media platforms are not configured. Please contact your administrator.
          </p>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              About Social Media Connections
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                When you connect your social media accounts, we securely store your access tokens to enable:
              </p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Publishing content to your accounts</li>
                <li>Collecting analytics and engagement data</li>
                <li>Managing your posts and campaigns</li>
              </ul>
              <p className="mt-2">
                You can disconnect any account at any time. Your data will remain secure and encrypted.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}