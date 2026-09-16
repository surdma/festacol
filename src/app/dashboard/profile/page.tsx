import { redirect } from "next/navigation";
import { FadeUp } from "@/components/motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { currentStudent } from "@/lib/auth/current-student";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const ctx = await currentStudent();
  if (!ctx) redirect("/?next=/dashboard/profile");
  return (
    <FadeUp className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{ctx.profile.full_name}</CardTitle>
          <CardDescription>
            Identity (firstname + lastname) is fixed. Guardian and phone are
            editable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            phone={ctx.profile.phone}
            guardian={ctx.profile.guardian}
          />
        </CardContent>
      </Card>
    </FadeUp>
  );
}
