import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Key, Save, Eye, EyeOff, CheckCircle2, ExternalLink } from 'lucide-react';
import { isSupabaseEnabled, getClaudeApiKey, saveClaudeApiKey } from '@/lib/supabase';

const API_KEY_STORAGE_KEY = 'mito_claude_api_key';

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [storageLocation, setStorageLocation] = useState<'localStorage' | 'supabase'>('localStorage');

  useEffect(() => {
    loadApiKey();
  }, []);

  async function loadApiKey() {
    // Try Supabase first if enabled
    if (isSupabaseEnabled) {
      const supabaseKey = await getClaudeApiKey();
      if (supabaseKey) {
        setApiKey(supabaseKey);
        setStorageLocation('supabase');
        // Also save to localStorage as cache
        localStorage.setItem(API_KEY_STORAGE_KEY, supabaseKey);
        return;
      }
    }

    // Fallback to localStorage
    const localKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (localKey) {
      setApiKey(localKey);
      setStorageLocation('localStorage');
      
      // If Supabase is enabled, sync the local key to Supabase
      if (isSupabaseEnabled) {
        await saveClaudeApiKey(localKey);
        setStorageLocation('supabase');
      }
    }
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    setIsSaving(true);

    // Save to localStorage first (instant)
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);

    // Save to Supabase if enabled (primary storage)
    if (isSupabaseEnabled) {
      const saved = await saveClaudeApiKey(apiKey);
      if (saved) {
        setStorageLocation('supabase');
      } else {
        alert('Failed to save to Supabase, but saved locally');
        setStorageLocation('localStorage');
      }
    } else {
      setStorageLocation('localStorage');
    }

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  async function handleClear() {
    if (confirm('Are you sure you want to clear your API key? You will need to re-enter it to use the analysis feature.')) {
      setApiKey('');
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      
      // Also clear from Supabase if enabled
      if (isSupabaseEnabled) {
        await saveClaudeApiKey('');
      }
      
      setSaveSuccess(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* API Key Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Claude API Key
          </CardTitle>
          <CardDescription>
            Manage your Anthropic Claude API key for biomarker analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Storage Location Info */}
          <Alert>
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>
                  <strong>Storage:</strong> {storageLocation === 'supabase' ? 'Supabase (synced across devices)' : 'Browser localStorage (this device only)'}
                </span>
                {isSupabaseEnabled && storageLocation === 'supabase' && (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="font-mono"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowApiKey(!showApiKey)}
                type="button"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {storageLocation === 'supabase' 
                ? 'Your API key is stored securely in Supabase and syncs across devices.'
                : 'Your API key is stored in your browser localStorage (this device only).'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save API Key'}
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleClear}>
              Clear Key
            </Button>
          </div>

          <Separator />

          {/* Get API Key Link */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">Don't have an API key?</h4>
            <p className="text-sm text-muted-foreground">
              Get your Claude API key from the Anthropic Console.
            </p>
            <Button variant="outline" size="sm" asChild className="gap-2">
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Get API Key
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cost Information */}
      <Card>
        <CardHeader>
          <CardTitle>API Usage & Costs</CardTitle>
          <CardDescription>
            Understanding Claude API costs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="font-semibold text-blue-900">Model</p>
              <p className="text-sm text-blue-700">Claude 3.5 Haiku</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="font-semibold text-green-900">Typical Cost</p>
              <p className="text-sm text-green-700">~$0.01-0.02 per 8-PDF analysis</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            We use text extraction (not image processing) to minimize costs. 
            Check <a href="https://www.anthropic.com/pricing" target="_blank" rel="noopener noreferrer" className="text-primary underline">Anthropic's pricing</a> for current rates.
          </p>
        </CardContent>
      </Card>

      {/* Supabase Status */}
      {!isSupabaseEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Supabase Integration</CardTitle>
            <CardDescription>
              Optional cloud storage and sync
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                <p className="mb-2">
                  <strong>Supabase is not configured.</strong> The app works without it, but you'll get these benefits if you set it up:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                  <li>Sync API key across all your devices</li>
                  <li>Client library (manage patient records)</li>
                  <li>Analysis history tracking</li>
                  <li>Custom benchmark sync</li>
                </ul>
                <p className="mt-4 text-sm">
                  See <code className="bg-muted px-1 py-0.5 rounded">SUPABASE_SETUP.md</code> for setup instructions.
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

