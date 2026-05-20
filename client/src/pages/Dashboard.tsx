import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Loader2, Plus } from "lucide-react";

export default function Dashboard() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    subjectLine: "",
    body: "",
    category: "General",
  });

  const templatesQuery = trpc.templates.list.useQuery();
  const metricsQuery = trpc.metrics.dashboard.useQuery();
  const createTemplateMutation = trpc.templates.create.useMutation();

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTemplateMutation.mutateAsync(formData);
      setFormData({ name: "", subjectLine: "", body: "", category: "General" });
      setIsCreateOpen(false);
      templatesQuery.refetch();
      metricsQuery.refetch();
    } catch (error) {
      console.error("Failed to create template:", error);
    }
  };

  const templates = templatesQuery.data || [];
  const metrics = metricsQuery.data;

  // Sort templates by creation date (newest first)
  const topTemplates = templates.slice(0, 3);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-foreground">TemplateFlow</h1>
            <p className="text-muted-foreground mt-2">Track your email template performance in real-time</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Create New Template</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTemplate} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-foreground">
                    Template Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Cold Outreach - Tech"
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="subject" className="text-foreground">
                    Subject Line
                  </Label>
                  <Input
                    id="subject"
                    value={formData.subjectLine}
                    onChange={(e) => setFormData({ ...formData, subjectLine: e.target.value })}
                    placeholder="Email subject line"
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="body" className="text-foreground">
                    Email Body
                  </Label>
                  <Textarea
                    id="body"
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    placeholder="Email body content"
                    className="bg-input border-border text-foreground min-h-[150px]"
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  Create Template
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            label="Total Templates"
            value={metrics?.totalTemplates || 0}
            loading={metricsQuery.isLoading}
          />
          <KPICard
            label="Total Sends"
            value={metrics?.totalSends || 0}
            loading={metricsQuery.isLoading}
          />
          <KPICard
            label="Avg Open Rate"
            value={`${(metrics?.avgOpenRate || 0).toFixed(1)}%`}
            loading={metricsQuery.isLoading}
          />
          <KPICard
            label="Avg Reply Rate"
            value={`${(metrics?.avgReplyRate || 0).toFixed(1)}%`}
            loading={metricsQuery.isLoading}
          />
          <KPICard
            label="Meetings Booked"
            value={metrics?.totalMeetingsBooked || 0}
            loading={metricsQuery.isLoading}
          />
        </div>

        {/* Top Templates */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">Top Performing Templates</h2>
          {templatesQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : topTemplates.length === 0 ? (
            <Card className="bg-card border-border p-8 text-center">
              <p className="text-muted-foreground">No templates yet. Create one to get started!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function KPICard({ label, value, loading }: { label: string; value: string | number; loading: boolean }) {
  return (
    <Card className="bg-card border-border p-6">
      <p className="text-muted-foreground text-sm mb-2">{label}</p>
      <p className="text-3xl font-bold text-accent">{loading ? <Loader2 className="w-6 h-6 animate-spin" /> : value}</p>
    </Card>
  );
}

interface TemplateWithMetrics {
  id: number;
  name: string;
  subjectLine: string;
  metrics?: { totalSends: number; opens: number; replies: number; meetingsBooked: number };
}

function TemplateCard({ template }: { template: TemplateWithMetrics }) {
  const metricsQuery = trpc.metrics.getByTemplate.useQuery({ templateId: template.id });
  const metrics = metricsQuery.data;
  const sends = metrics?.totalSends || 0;
  const opens = metrics?.opens || 0;
  const replies = metrics?.replies || 0;
  const openRate = sends > 0 ? ((opens / sends) * 100).toFixed(1) : "0";
  const replyRate = sends > 0 ? ((replies / sends) * 100).toFixed(1) : "0";
  const totalSends = sends;

  return (
    <Link href={`/template/${template.id}`}>
      <Card className="bg-card border-border hover:border-accent/50 cursor-pointer transition p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">{template.name}</h3>
        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{template.subjectLine}</p>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Open Rate</p>
            <p className="text-accent font-semibold">{openRate}%</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Reply Rate</p>
            <p className="text-accent font-semibold">{replyRate}%</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Sends</p>
            <p className="text-accent font-semibold">{totalSends}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
