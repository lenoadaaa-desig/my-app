import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ROLE_LABELS_TH: Record<string, string> = {
  customer: "ลูกค้า",
  owner: "เจ้าของร้าน",
  admin: "แอดมิน",
};

export default async function DashboardPage() {
  const profile = await getProfile();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-canvas px-4 py-12 text-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">สวัสดี, {profile.email}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Badge variant="secondary">{ROLE_LABELS_TH[profile.role] ?? profile.role}</Badge>

          {profile.role === "admin" && (
            <Link href="/admin" className="text-sm font-medium text-gold hover:underline">
              ไปที่หน้าแอดมิน
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
