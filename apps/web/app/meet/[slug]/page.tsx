import type { Metadata } from "next";
import PublicMeetingClient from "./PublicMeetingClient";

interface Props {
  params: Promise<{ slug: string }>;
}

async function fetchPublicMeeting(slug: string) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const res = await fetch(`${baseUrl}/meetings/public/${slug}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function generateMetadata({ params: paramsPromise }: Props): Promise<Metadata> {
  const params = await paramsPromise;
  const meeting = await fetchPublicMeeting(params.slug);
  const siteUrl = "https://teams.neuravolt.in";

  if (!meeting) {
    return {
      title: "Meeting Not Found | NeuraConnect",
      description: "You have been invited to a NeuraConnect secure meeting.",
    };
  }

  const title = `${meeting.title} | NeuraConnect`;
  const description = "You have been invited to a NeuraConnect secure meeting.";
  const publicUrl = `${siteUrl}/meet/${params.slug}`;
  const ogImageUrl = `${siteUrl}/neuravolt-og.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: publicUrl,
      siteName: "nORBIT",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: "NeuraConnect Gateway",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function PublicMeetingPage({ params: paramsPromise }: Props) {
  const params = await paramsPromise;
  return <PublicMeetingClient slug={params.slug} />;
}
