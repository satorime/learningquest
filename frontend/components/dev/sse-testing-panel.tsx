"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGlobalXPReward } from "@/contexts/xp-reward-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Wifi, 
  WifiOff, 
  TestTube, 
  Zap, 
  List, 
  Trash2,
  Activity,
  Globe
} from "lucide-react";

// API URL from environment
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api";

export function SSETestingPanel() {
  const { user } = useCurrentUser();
  const {
    triggerXPReward,
    queueLength,
    isConnected,
    clearQueue,
  } = useGlobalXPReward();

  // Test form state
  const [testXP, setTestXP] = useState(50);
  const [testTitle, setTestTitle] = useState("Test Quest Completed!");
  const [testTotalXP, setTestTotalXP] = useState(1250);

  // Manual test notification
  const handleManualTest = () => {
    triggerXPReward(testXP, testTitle, testTotalXP, "manual_test");
  };

  // Test SSE endpoint directly
  const handleSSETest = async () => {
    if (!user?.id) {
      console.error("No user ID available for SSE test");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/notifications/test/${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          xp_earned: testXP,
          quest_title: testTitle,
          total_xp: testTotalXP,
          source_type: "sse_test"
        })
      });

      if (response.ok) {
        console.log("SSE test notification sent successfully");
      } else {
        console.error("Failed to send SSE test notification:", response.statusText);
      }
    } catch (error) {
      console.error("Error sending SSE test notification:", error);
    }
  };

  // Check SSE service status
  const handleStatusCheck = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/status`);
      const status = await response.json();
      console.log("SSE Service Status:", status);
    } catch (error) {
      console.error("Error checking SSE status:", error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5 text-primary" />
          Real-time XP Notifications Testing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">Connected to SSE</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700">Disconnected</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <List className="h-3 w-3" />
              {queueLength} queued
            </Badge>
            {queueLength > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearQueue}
                className="gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Test Configuration */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Test Notification Parameters</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-xp">XP Earned</Label>
              <Input
                id="test-xp"
                type="number"
                value={testXP}
                onChange={(e) => setTestXP(Number(e.target.value))}
                min="1"
                max="1000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-title">Quest Title</Label>
              <Input
                id="test-title"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="Quest completed!"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-total">Total XP</Label>
              <Input
                id="test-total"
                type="number"
                value={testTotalXP}
                onChange={(e) => setTestTotalXP(Number(e.target.value))}
                min="0"
                max="10000"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Test Actions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Test Actions</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              onClick={handleManualTest}
              className="gap-2"
              variant="default"
            >
              <Zap className="h-4 w-4" />
              Manual Test
            </Button>
            <Button
              onClick={handleSSETest}
              className="gap-2"
              variant="outline"
              disabled={!user?.id}
            >
              <Activity className="h-4 w-4" />
              SSE Test
            </Button>
            <Button
              onClick={handleStatusCheck}
              className="gap-2"
              variant="outline"
            >
              <Globe className="h-4 w-4" />
              Check Status
            </Button>
          </div>
        </div>

        {/* User Info */}
        {user && (
          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
            <strong>Current User:</strong> {user.username} (ID: {user.id})
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Manual Test:</strong> Triggers popup directly using the global context</p>
          <p><strong>SSE Test:</strong> Sends a test notification through the SSE endpoint</p>
          <p><strong>Real Test:</strong> Complete a quiz in Moodle to trigger real notifications</p>
        </div>
      </CardContent>
    </Card>
  );
}
