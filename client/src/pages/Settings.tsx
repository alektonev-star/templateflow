import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { LogOut, User } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      setLocation("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account and preferences</p>
        </div>

        {/* Profile Card */}
        <Card className="bg-card border-border p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
              <User className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{user?.name || "User"}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="border-t border-border pt-6 space-y-4">
            <div>
              <p className="text-muted-foreground text-sm mb-1">Full Name</p>
              <p className="text-foreground font-medium">{user?.name || "Not set"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm mb-1">Email</p>
              <p className="text-foreground font-medium">{user?.email || "Not set"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm mb-1">Account Type</p>
              <p className="text-foreground font-medium capitalize">{user?.role || "User"}</p>
            </div>
          </div>
        </Card>

        {/* Logout Section */}
        <Card className="bg-card border-border p-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Session</h3>
          <p className="text-muted-foreground mb-6">Sign out of your account on this device.</p>
          <Button
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
          </Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}
