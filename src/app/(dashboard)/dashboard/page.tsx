"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface DashboardStats {
  totalThreads: number;
  unreadThreads: number;
  totalContacts: number;
  slaAtRisk: number;
  pipelineCounts: {
    lead: number;
    engaged: number;
    converted: number;
    lost: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalThreads: 0,
    unreadThreads: 0,
    totalContacts: 0,
    slaAtRisk: 0,
    pipelineCounts: {
      lead: 0,
      engaged: 0,
      converted: 0,
      lost: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);

      // Load threads and calculate stats
      const [threadsRes, contactsRes] = await Promise.all([
        fetch("/api/v1/threads?pageSize=1000"),
        fetch("/api/v1/contacts?pageSize=1"),
      ]);

      const threadsData = await threadsRes.json();
      const contactsData = await contactsRes.json();

      const threads = threadsData.data || [];

      const stats: DashboardStats = {
        totalThreads: threads.length,
        unreadThreads: threads.filter((t: any) => t.hasUnreadMessages).length,
        totalContacts: contactsData.pagination?.total || 0,
        slaAtRisk: threads.filter((t: any) => t.isSlaCritical).length,
        pipelineCounts: {
          lead: threads.filter((t: any) => t.pipelineStage === "lead").length,
          engaged: threads.filter((t: any) => t.pipelineStage === "engaged")
            .length,
          converted: threads.filter((t: any) => t.pipelineStage === "converted")
            .length,
          lost: threads.filter((t: any) => t.pipelineStage === "lost").length,
        },
      };

      setStats(stats);
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const conversionRate =
    stats.pipelineCounts.lead > 0
      ? (
          (stats.pipelineCounts.converted /
            (stats.pipelineCounts.lead + stats.pipelineCounts.engaged)) *
          100
        ).toFixed(1)
      : "0.0";

  return (
    <div className="flex h-screen flex-col overflow-auto">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your sales desk performance
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Conversations
              </CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalThreads}</div>
              {stats.unreadThreads > 0 && (
                <Badge variant="default" className="mt-2">
                  {stats.unreadThreads} unread
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Contacts
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalContacts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all channels
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Conversion Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.pipelineCounts.converted} converted
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SLA at Risk</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.slaAtRisk}</div>
              {stats.slaAtRisk > 0 && (
                <Badge variant="destructive" className="mt-2">
                  Requires attention
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Overview */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Lead</span>
                    <Badge variant="outline" className="bg-blue-50">
                      {stats.pipelineCounts.lead}
                    </Badge>
                  </div>
                  <div className="h-2 w-full rounded-full bg-blue-100">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{
                        width: `${
                          (stats.pipelineCounts.lead / stats.totalThreads) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Engaged</span>
                    <Badge variant="outline" className="bg-yellow-50">
                      {stats.pipelineCounts.engaged}
                    </Badge>
                  </div>
                  <div className="h-2 w-full rounded-full bg-yellow-100">
                    <div
                      className="h-2 rounded-full bg-yellow-500"
                      style={{
                        width: `${
                          (stats.pipelineCounts.engaged / stats.totalThreads) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Converted</span>
                    <Badge variant="outline" className="bg-green-50">
                      {stats.pipelineCounts.converted}
                    </Badge>
                  </div>
                  <div className="h-2 w-full rounded-full bg-green-100">
                    <div
                      className="h-2 rounded-full bg-green-500"
                      style={{
                        width: `${
                          (stats.pipelineCounts.converted / stats.totalThreads) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Lost</span>
                    <Badge variant="outline" className="bg-red-50">
                      {stats.pipelineCounts.lost}
                    </Badge>
                  </div>
                  <div className="h-2 w-full rounded-full bg-red-100">
                    <div
                      className="h-2 rounded-full bg-red-500"
                      style={{
                        width: `${
                          (stats.pipelineCounts.lost / stats.totalThreads) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {stats.unreadThreads} unread conversations and {stats.slaAtRisk}{" "}
                SLA-critical threads
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {stats.totalThreads} active conversations across all channels
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
