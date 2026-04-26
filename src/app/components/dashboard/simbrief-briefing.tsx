import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export function SimBriefBriefing() {
  return (
    <div className="space-y-6">
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-xl font-bold">SimBrief</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10 text-gray-500 font-semibold tracking-wide">
            IN DEVELOPMENT
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
