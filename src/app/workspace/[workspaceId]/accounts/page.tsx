import { SocialAccountManager } from "@/app/_components/social-account-manager";

interface SocialAccountsPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default async function SocialAccountsPage({ params }: SocialAccountsPageProps) {
  const { workspaceId } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <SocialAccountManager workspaceId={workspaceId} />
      </div>
    </div>
  );
}