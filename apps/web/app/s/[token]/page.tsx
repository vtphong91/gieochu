import { AppError } from "@gieochu/core";
import { resolveShareLink } from "../../../lib/share-link";
import { ShareLinkDownloadPanel } from "./download-panel";

export default async function ShareLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let resolved;
  try {
    resolved = await resolveShareLink(token);
  } catch (error) {
    if (error instanceof AppError) {
      return (
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-lg font-medium">{error.httpStatus === 404 ? "Không tìm thấy link chia sẻ." : "Link không còn hiệu lực."}</p>
        </main>
      );
    }
    throw error;
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-sm text-gray-500">{resolved.tenantName}</p>
      <h1 className="mt-1 text-2xl font-bold">{resolved.productTitle}</h1>
      {resolved.shareLink.label ? <p className="mt-1 text-sm text-gray-500">{resolved.shareLink.label}</p> : null}

      <ShareLinkDownloadPanel token={token} files={resolved.files} requiresPassword={resolved.requiresPassword} />
    </main>
  );
}
