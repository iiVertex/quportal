"use client";

import { useState, useEffect } from "react";
import { Save, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email || "");
      setFullName(user.user_metadata?.full_name || "");
      setUniversity(user.user_metadata?.university || "");
    }
    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();

    await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        university,
      },
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings</p>
      </div>

      <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary stroke-[2px]" />
            Profile
          </CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="rounded-2xl bg-muted"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-2xl"
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="university">University</Label>
            <Input
              id="university"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              className="rounded-2xl"
              placeholder="Your university"
            />
          </div>

          <Separator />

          <Button onClick={handleSave} disabled={saving} className="rounded-2xl gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
