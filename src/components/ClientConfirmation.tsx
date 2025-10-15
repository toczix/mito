import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, UserCircle, Calendar, Users } from 'lucide-react';
import type { PatientInfo } from '@/lib/claude-service';
import type { ClientMatchResult } from '@/lib/client-matcher';

interface ClientConfirmationProps {
  patientInfo: PatientInfo;
  matchResult: ClientMatchResult;
  onConfirm: (confirmedInfo: PatientInfo, useExistingClient: boolean) => void;
  onCancel: () => void;
}

export function ClientConfirmation({ 
  patientInfo, 
  matchResult, 
  onConfirm, 
  onCancel 
}: ClientConfirmationProps) {
  const [editedInfo, setEditedInfo] = useState<PatientInfo>(patientInfo);
  const [useExisting, setUseExisting] = useState(matchResult.matched);

  useEffect(() => {
    setEditedInfo(patientInfo);
    setUseExisting(matchResult.matched);
  }, [patientInfo, matchResult]);

  const handleConfirm = () => {
    onConfirm(editedInfo, useExisting && matchResult.client !== null);
  };

  const renderMatchInfo = () => {
    if (!matchResult.matched || !matchResult.client) {
      return (
        <Alert>
          <UserCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <strong>New Client Detected</strong>
            <p className="text-sm mt-1">
              No existing client found. A new client record will be created.
            </p>
          </AlertDescription>
        </Alert>
      );
    }

    const client = matchResult.client;
    const confidenceBadge = 
      matchResult.confidence === 'high' ? 
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          High Confidence
        </Badge> :
      matchResult.confidence === 'medium' ?
        <Badge variant="secondary" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Medium Confidence
        </Badge> :
        <Badge variant="outline" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Low Confidence
        </Badge>;

    return (
      <div className="space-y-4">
        <Alert className={matchResult.confidence === 'high' ? 'border-green-500 bg-green-50' : ''}>
          <Users className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <div className="flex items-center justify-between mb-2">
              <strong>Existing Client Match Found</strong>
              {confidenceBadge}
            </div>
            <div className="text-sm space-y-1">
              <p><strong>Name:</strong> {client.full_name}</p>
              {client.date_of_birth && (
                <p><strong>DOB:</strong> {client.date_of_birth}</p>
              )}
              {client.gender && (
                <p><strong>Gender:</strong> {client.gender}</p>
              )}
              {client.email && (
                <p><strong>Email:</strong> {client.email}</p>
              )}
            </div>
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-4">
          <Label className="text-base">Add results to this client?</Label>
          <div className="flex gap-2">
            <Button
              variant={useExisting ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUseExisting(true)}
            >
              Yes, Use Existing
            </Button>
            <Button
              variant={!useExisting ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUseExisting(false)}
            >
              No, Create New
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle className="h-6 w-6" />
          Confirm Patient Information
        </CardTitle>
        <CardDescription>
          Review and edit the information extracted from the lab report
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Match Status */}
        {renderMatchInfo()}

        {/* Extracted Information - Editable */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <h3 className="font-medium text-sm text-muted-foreground">
            Extracted Information (Editable)
          </h3>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="patient-name">Full Name *</Label>
              <Input
                id="patient-name"
                value={editedInfo.name || ''}
                onChange={(e) => setEditedInfo({ ...editedInfo, name: e.target.value })}
                placeholder="Patient Name"
              />
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label htmlFor="patient-dob">Date of Birth</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="patient-dob"
                  type="date"
                  value={editedInfo.dateOfBirth || ''}
                  onChange={(e) => setEditedInfo({ ...editedInfo, dateOfBirth: e.target.value })}
                />
              </div>
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label htmlFor="patient-gender">Gender</Label>
              <Select
                value={editedInfo.gender || 'other'}
                onValueChange={(value: 'male' | 'female' | 'other') => 
                  setEditedInfo({ ...editedInfo, gender: value })
                }
              >
                <SelectTrigger id="patient-gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Test Date */}
            <div className="space-y-2">
              <Label htmlFor="test-date">Lab Test Date</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="test-date"
                  type="date"
                  value={editedInfo.testDate || ''}
                  onChange={(e) => setEditedInfo({ ...editedInfo, testDate: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            className="flex-1 gap-2"
            disabled={!editedInfo.name}
          >
            <CheckCircle2 className="h-4 w-4" />
            {useExisting && matchResult.client ? 'Add to Existing Client' : 'Create Client & Continue'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

