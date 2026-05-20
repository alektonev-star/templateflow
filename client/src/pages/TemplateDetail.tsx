import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useParams, useLocation } from "wouter";
import { Loader2, ArrowLeft, Sparkles, Trash2, Edit2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function TemplateDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const templateId = parseInt(params.id || "0");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", subjectLine: "", body: "" });

  const templateQuery = trpc.templates.get.useQuery({ id: templateId });
  const metricsQuery = trpc.metrics.getByTemplate.useQuery({ templateId });
  const suggestionsQuery = trpc.ai.getSuggestions.useQuery({ templateId });
  const generateSuggestionsMutation = trpc.ai.generateSuggestions.useMutation();
  const updateMutation = trpc.templates.update.useMutation();
  const deleteMutation = trpc.templates.delete.useMutation();
  const utils = trpc.useUtils();

  const template = templateQuery.data;
  const metrics = metricsQuery.data;

  const handleGenerateSuggestions = async () => {
    setIsGenerating(true);
    try {
      const result = await generateSuggestionsMutation.mutateAsync({ templateId });
      setSuggestions(result);
      suggestionsQuery.refetch();
    } catch (error) {
      console.error("Failed to generate suggestions:", error);
      toast.error("Failed to generate suggestions");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditOpen = () => {
    if (template) {
      setEditForm({ name: template.name, subjectLine: template.subjectLine, body: template.body });
      setIsEditOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await updateMutation.mutateAsync({
        id: templateId,
        name: editForm.name,
        subjectLine: editForm.subjectLine,
        body: editForm.body,
      });
      await utils.templates.get.invalidate({ id: templateId });
      setIsEditOpen(false);
      toast.success("Template updated successfully");
    } catch (error) {
      toast.error("Failed to update template");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: templateId });
      await utils.templates.list.invalidate();
      toast.success("Template deleted successfully");
      setLocation("/");
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  // Generate mock 30-day trend data
  const replies = metrics?.replies || 0;
  const totalSends = metrics?.totalSends || 1;
  const trendData = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    replyRate: Math.max(0, (replies / totalSends) * 100 + Math.random() * 10 - 5),
  }));

  if (templateQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!template) {
    return (
      <DashboardLayout>
        <Card className="bg-card border-border p-8 text-center">
          <p className="text-muted-foreground">Template not found</p>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with Edit/Delete Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" className="border-border hover:bg-muted">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{template.name}</h1>
              <p className="text-muted-foreground mt-1">{template.subjectLine}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleEditOpen}
                  variant="outline"
                  className="border-border hover:bg-muted"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Edit Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                      id="name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="bg-muted border-border mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      value={editForm.subjectLine}
                      onChange={(e) => setEditForm({ ...editForm, subjectLine: e.target.value })}
                      className="bg-muted border-border mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="body">Body</Label>
                    <Textarea
                      id="body"
                      value={editForm.body}
                      onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                      className="bg-muted border-border mt-1 min-h-32"
                    />
                  </div>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground w-full"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-red-500/50 hover:bg-red-500/10 text-red-400">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Template</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this template? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex gap-3 justify-end">
                  <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            label="Total Sends"
            value={metrics?.totalSends || 0}
            loading={metricsQuery.isLoading}
          />
          <MetricCard
            label="Opens"
            value={metrics?.opens || 0}
            loading={metricsQuery.isLoading}
          />
          <MetricCard
            label="Replies"
            value={metrics?.replies || 0}
            loading={metricsQuery.isLoading}
          />
          <MetricCard
            label="Meetings Booked"
            value={metrics?.meetingsBooked || 0}
            loading={metricsQuery.isLoading}
          />
        </div>

        {/* Performance Rates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-card border-border p-6">
            <p className="text-muted-foreground text-sm mb-2">Open Rate</p>
            <p className="text-4xl font-bold text-accent">
              {metrics && (metrics.totalSends || 0) > 0
                ? (((metrics.opens || 0) / (metrics.totalSends || 1)) * 100).toFixed(1)
                : "0"}%
            </p>
          </Card>
          <Card className="bg-card border-border p-6">
            <p className="text-muted-foreground text-sm mb-2">Reply Rate</p>
            <p className="text-4xl font-bold text-accent">
              {metrics && (metrics.totalSends || 0) > 0
                ? (((metrics.replies || 0) / (metrics.totalSends || 1)) * 100).toFixed(1)
                : "0"}%
            </p>
          </Card>
        </div>

        {/* 30-Day Trend */}
        <Card className="bg-card border-border p-6">
          <h3 className="text-xl font-semibold text-foreground mb-4">30-Day Reply Rate Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.20 0.01 262)" />
              <XAxis stroke="oklch(0.70 0.01 65)" />
              <YAxis stroke="oklch(0.70 0.01 65)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.12 0.01 262)",
                  border: "1px solid oklch(0.20 0.01 262)",
                  color: "oklch(0.95 0.01 65)",
                }}
              />
              <Line
                type="monotone"
                dataKey="replyRate"
                stroke="oklch(0.65 0.25 262)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Template Content */}
        <Card className="bg-card border-border p-6">
          <h3 className="text-xl font-semibold text-foreground mb-4">Template Content</h3>
          <div className="space-y-4">
            <div>
              <p className="text-muted-foreground text-sm mb-2">Subject Line</p>
              <p className="text-foreground bg-muted/30 p-3 rounded border border-border">{template.subjectLine}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm mb-2">Body</p>
              <p className="text-foreground bg-muted/30 p-3 rounded border border-border whitespace-pre-wrap">
                {template.body}
              </p>
            </div>
          </div>
        </Card>

        {/* AI Suggestions */}
        <Card className="bg-card border-border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-foreground">AI Improvement Suggestions</h3>
            <Button
              onClick={handleGenerateSuggestions}
              disabled={isGenerating}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isGenerating ? "Generating..." : "Generate Suggestions"}
            </Button>
          </div>

          {isGenerating ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : suggestions.length > 0 || suggestionsQuery.data?.length ? (
            <div className="space-y-4">
              {(suggestions.length > 0 ? suggestions : suggestionsQuery.data || []).map((suggestion, idx) => (
                <div key={idx} className="border border-border rounded p-4 bg-muted/20">
                  <p className="text-sm font-semibold text-accent mb-2">
                    {suggestion.area === "subject_line"
                      ? "📧 Subject Line"
                      : suggestion.area === "opening_hook"
                      ? "🎣 Opening Hook"
                      : "✓ Call-to-Action"}
                  </p>
                  <p className="text-muted-foreground text-sm mb-3">{suggestion.suggestionText}</p>
                  <div className="bg-muted/40 p-3 rounded border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Suggested change:</p>
                    <p className="text-foreground">{suggestion.suggestedChange}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No suggestions yet. Click the button above to generate AI suggestions.</p>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <Card className="bg-card border-border p-4">
      <p className="text-muted-foreground text-sm mb-2">{label}</p>
      <p className="text-2xl font-bold text-accent">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : value}</p>
    </Card>
  );
}
