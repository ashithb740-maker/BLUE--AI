import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";

export default function NotFound() {
  const [, setLocation] = useLocation();
  const { theme } = useTheme();
  const handleGoHome = () => setLocation("/");

  return (
    <div className={`min-h-screen w-full flex items-center justify-center ${theme === "dark" ? "bg-[#08090d] text-white" : "bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900"}`}>
      <Card className={`w-full max-w-lg mx-4 shadow-lg backdrop-blur-sm ${theme === "dark" ? "border-white/10 bg-[#11131a]" : "border-0 bg-white/80"}`}>
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6"><div className="relative"><div className={`absolute inset-0 rounded-full animate-pulse ${theme === "dark" ? "bg-red-400/10" : "bg-red-100"}`} /><AlertCircle className="relative h-16 w-16 text-red-500" /></div></div>
          <h1 className={`text-4xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>404</h1>
          <h2 className={`text-xl font-semibold mb-4 ${theme === "dark" ? "text-white/80" : "text-slate-700"}`}>Page Not Found</h2>
          <p className={`mb-8 leading-relaxed ${theme === "dark" ? "text-white/55" : "text-slate-600"}`}>Sorry, the page you are looking for doesn't exist.<br />It may have been moved or deleted.</p>
          <Button onClick={handleGoHome} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"><Home className="w-4 h-4 mr-2" />Go Home</Button>
        </CardContent>
      </Card>
    </div>
  );
}
