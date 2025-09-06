'use client';

/**
 * Registration Form Component for BRF Portal
 * Multi-step wizard for new member registration with Swedish BRF context
 */

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Home, 
  FileText, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  Building,
  Users,
  Shield
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  validatePersonnummer, 
  validateSwedishPostalCode,
  validateSwedishPhoneNumber,
  formatPersonnummer,
  formatSwedishPostalCode,
  validateSwedishApartmentNumber,
  formatSwedishApartmentNumber
} from '@/lib/utils/swedish';
import { BankIDMock, type BankIDUser } from '@/components/auth/BankIDMock';

/**
 * Registration steps
 */
export type RegistrationStep = 
  | 'method-selection'
  | 'personal-info' 
  | 'address-info' 
  | 'apartment-selection' 
  | 'verification' 
  | 'terms' 
  | 'complete';

/**
 * Registration method options
 */
export type RegistrationMethod = 'bankid' | 'manual' | 'invitation';

/**
 * Form data interface
 */
export interface RegistrationData {
  // Method
  method: RegistrationMethod;
  
  // Personal Information
  personnummer: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password?: string;
  confirmPassword?: string;
  
  // Address Information
  streetAddress: string;
  postalCode: string;
  city: string;
  
  // Apartment Information
  apartmentNumber: string;
  cooperativeId: string;
  invitationCode?: string;
  
  // Verification
  emailVerified: boolean;
  phoneVerified: boolean;
  bankidVerified: boolean;
  
  // Terms and Consents
  acceptedTerms: boolean;
  acceptedPrivacyPolicy: boolean;
  acceptedDataProcessing: boolean;
  marketingConsent: boolean;
}

/**
 * Mock apartment data for selection
 */
const MOCK_APARTMENTS = [
  { number: '1101', floor: '11', size: '72 m²', rooms: '3 rum', fee: '4,850 kr/mån', available: true },
  { number: '0205', floor: '2', size: '58 m²', rooms: '2 rum', fee: '3,920 kr/mån', available: true },
  { number: '0808', floor: '8', size: '95 m²', rooms: '4 rum', fee: '6,100 kr/mån', available: false },
  { number: '0403', floor: '4', size: '45 m²', rooms: '1 rum', fee: '2,850 kr/mån', available: true },
];

interface RegisterFormProps {
  /**
   * Callback fired on successful registration
   */
  onSuccess?: (data: RegistrationData) => void;
  /**
   * Callback fired on registration error
   */
  onError?: (error: string) => void;
  /**
   * Optional cooperative ID to pre-fill
   */
  cooperativeId?: string;
  /**
   * Optional invitation code for pre-validation
   */
  invitationCode?: string;
  /**
   * Additional CSS classes
   */
  className?: string;
}

export function RegisterForm({
  onSuccess,
  onError,
  cooperativeId = '',
  invitationCode = '',
  className
}: RegisterFormProps) {
  const router = useRouter();
  
  // Form state
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('method-selection');
  const [formData, setFormData] = useState<RegistrationData>({
    method: 'manual',
    personnummer: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    streetAddress: '',
    postalCode: '',
    city: '',
    apartmentNumber: '',
    cooperativeId,
    invitationCode,
    emailVerified: false,
    phoneVerified: false,
    bankidVerified: false,
    acceptedTerms: false,
    acceptedPrivacyPolicy: false,
    acceptedDataProcessing: false,
    marketingConsent: false,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /**
   * Update form data and clear related errors
   */
  const updateFormData = useCallback((updates: Partial<RegistrationData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    
    // Clear errors for updated fields
    const errorKeys = Object.keys(updates);
    if (errorKeys.length > 0) {
      setErrors(prev => {
        const newErrors = { ...prev };
        errorKeys.forEach(key => delete newErrors[key]);
        return newErrors;
      });
    }
  }, []);

  /**
   * Validate current step
   */
  const validateCurrentStep = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 'method-selection':
        if (!formData.method) {
          newErrors.method = 'Välj en registreringsmetod';
        }
        break;

      case 'personal-info':
        if (formData.method === 'manual') {
          if (!formData.personnummer) {
            newErrors.personnummer = 'Personnummer krävs';
          } else if (!validatePersonnummer(formData.personnummer).isValid) {
            newErrors.personnummer = 'Ogiltigt personnummer';
          }
          
          if (!formData.firstName.trim()) {
            newErrors.firstName = 'Förnamn krävs';
          }
          
          if (!formData.lastName.trim()) {
            newErrors.lastName = 'Efternamn krävs';
          }
        }
        
        if (!formData.email.trim()) {
          newErrors.email = 'E-postadress krävs';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = 'Ogiltig e-postadress';
        }
        
        if (!formData.phone.trim()) {
          newErrors.phone = 'Telefonnummer krävs';
        } else if (!validateSwedishPhoneNumber(formData.phone).isValid) {
          newErrors.phone = 'Ogiltigt telefonnummer';
        }
        
        if (formData.method === 'manual') {
          if (!formData.password) {
            newErrors.password = 'Lösenord krävs';
          } else if (formData.password.length < 8) {
            newErrors.password = 'Lösenordet måste vara minst 8 tecken';
          }
          
          if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Bekräfta lösenordet';
          } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Lösenorden matchar inte';
          }
        }
        break;

      case 'address-info':
        if (!formData.streetAddress.trim()) {
          newErrors.streetAddress = 'Gatuadress krävs';
        }
        
        if (!formData.postalCode.trim()) {
          newErrors.postalCode = 'Postnummer krävs';
        } else if (!validateSwedishPostalCode(formData.postalCode)) {
          newErrors.postalCode = 'Ogiltigt postnummer';
        }
        
        if (!formData.city.trim()) {
          newErrors.city = 'Ort krävs';
        }
        break;

      case 'apartment-selection':
        if (!formData.apartmentNumber) {
          newErrors.apartmentNumber = 'Välj en lägenhet';
        }
        break;

      case 'terms':
        if (!formData.acceptedTerms) {
          newErrors.acceptedTerms = 'Du måste acceptera användarvillkoren';
        }
        
        if (!formData.acceptedPrivacyPolicy) {
          newErrors.acceptedPrivacyPolicy = 'Du måste acceptera integritetspolicyn';
        }
        
        if (!formData.acceptedDataProcessing) {
          newErrors.acceptedDataProcessing = 'Du måste godkänna databehandling';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentStep, formData]);

  /**
   * Navigate to next step
   */
  const nextStep = useCallback(() => {
    if (!validateCurrentStep()) return;

    const stepOrder: RegistrationStep[] = [
      'method-selection',
      'personal-info',
      'address-info',
      'apartment-selection',
      'verification',
      'terms',
      'complete'
    ];

    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  }, [currentStep, validateCurrentStep]);

  /**
   * Navigate to previous step
   */
  const prevStep = useCallback(() => {
    const stepOrder: RegistrationStep[] = [
      'method-selection',
      'personal-info',
      'address-info',
      'apartment-selection',
      'verification',
      'terms',
      'complete'
    ];

    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  }, [currentStep]);

  /**
   * Handle BankID success
   */
  const handleBankIDSuccess = useCallback((user: BankIDUser) => {
    updateFormData({
      method: 'bankid',
      personnummer: user.personalNumber,
      firstName: user.givenName,
      lastName: user.surname,
      bankidVerified: true,
    });
    
    setCurrentStep('address-info');
  }, [updateFormData]);

  /**
   * Submit registration
   */
  const submitRegistration = useCallback(async () => {
    if (!validateCurrentStep()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentStep('complete');
        onSuccess?.(formData);
      } else {
        setErrors({ submit: data.error || 'Registreringen misslyckades' });
        onError?.(data.error || 'Registreringen misslyckades');
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = 'Ett tekniskt fel uppstod. Försök igen.';
      setErrors({ submit: errorMessage });
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [formData, validateCurrentStep, onSuccess, onError]);

  /**
   * Get current step progress
   */
  const getStepProgress = (): number => {
    const steps = ['method-selection', 'personal-info', 'address-info', 'apartment-selection', 'verification', 'terms', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  /**
   * Get step title
   */
  const getStepTitle = (): string => {
    switch (currentStep) {
      case 'method-selection': return 'Välj registreringsmetod';
      case 'personal-info': return 'Personuppgifter';
      case 'address-info': return 'Adressuppgifter';
      case 'apartment-selection': return 'Välj lägenhet';
      case 'verification': return 'Verifiering';
      case 'terms': return 'Villkor och samtycken';
      case 'complete': return 'Registrering klar';
      default: return 'Registrering';
    }
  };

  return (
    <div className={cn('w-full max-w-2xl mx-auto', className)}>
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Bli medlem</h1>
          <Badge variant="outline">
            Steg {Math.ceil(getStepProgress() / 100 * 7)} av 7
          </Badge>
        </div>
        <Progress value={getStepProgress()} className="h-2" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {currentStep === 'method-selection' && <Shield className="w-5 h-5 text-blue-600" />}
            {currentStep === 'personal-info' && <User className="w-5 h-5 text-blue-600" />}
            {currentStep === 'address-info' && <MapPin className="w-5 h-5 text-blue-600" />}
            {currentStep === 'apartment-selection' && <Home className="w-5 h-5 text-blue-600" />}
            {currentStep === 'verification' && <Mail className="w-5 h-5 text-blue-600" />}
            {currentStep === 'terms' && <FileText className="w-5 h-5 text-blue-600" />}
            {currentStep === 'complete' && <CheckCircle className="w-5 h-5 text-green-600" />}
            <span>{getStepTitle()}</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Method Selection Step */}
          {currentStep === 'method-selection' && (
            <div className="space-y-4">
              <p className="text-gray-600 mb-6">
                Välj hur du vill registrera dig som medlem i bostadsrättsföreningen.
              </p>
              
              <RadioGroup
                value={formData.method}
                onValueChange={(value: RegistrationMethod) => updateFormData({ method: value })}
                className="space-y-4"
              >
                <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50">
                  <RadioGroupItem value="bankid" id="bankid" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="bankid" className="flex items-center space-x-2 cursor-pointer">
                      <Shield className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">BankID (Rekommenderat)</span>
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Snabb och säker registrering med BankID. Dina uppgifter fylls i automatiskt.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50">
                  <RadioGroupItem value="manual" id="manual" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="manual" className="flex items-center space-x-2 cursor-pointer">
                      <User className="w-5 h-5 text-gray-600" />
                      <span className="font-medium">Manuell registrering</span>
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Fyll i dina uppgifter manuellt. Kräver senare verifiering.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50">
                  <RadioGroupItem value="invitation" id="invitation" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="invitation" className="flex items-center space-x-2 cursor-pointer">
                      <Users className="w-5 h-5 text-purple-600" />
                      <span className="font-medium">Inbjudan från styrelsen</span>
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Du har fått en inbjudningskod från föreningens styrelse.
                    </p>
                  </div>
                </div>
              </RadioGroup>
              
              {errors.method && (
                <p className="text-sm text-red-600">{errors.method}</p>
              )}
            </div>
          )}

          {/* BankID Authentication */}
          {currentStep === 'method-selection' && formData.method === 'bankid' && (
            <div className="mt-6">
              <BankIDMock
                onSuccess={handleBankIDSuccess}
                onError={(error) => setErrors({ bankid: error.message })}
                showPersonnummerInput={false}
                deviceType="different"
              />
              {errors.bankid && (
                <p className="text-sm text-red-600 mt-2">{errors.bankid}</p>
              )}
            </div>
          )}

          {/* Personal Information Step */}
          {currentStep === 'personal-info' && (
            <div className="space-y-4">
              {formData.method === 'manual' && (
                <>
                  <div>
                    <Label htmlFor="personnummer" className="text-sm font-medium">
                      Personnummer *
                    </Label>
                    <Input
                      id="personnummer"
                      type="text"
                      value={formData.personnummer}
                      onChange={(e) => updateFormData({ personnummer: formatPersonnummer(e.target.value) })}
                      placeholder="YYYYMMDD-NNNN"
                      className={cn(errors.personnummer && 'border-red-300')}
                      maxLength={13}
                    />
                    {errors.personnummer && (
                      <p className="text-sm text-red-600 mt-1">{errors.personnummer}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" className="text-sm font-medium">
                        Förnamn *
                      </Label>
                      <Input
                        id="firstName"
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => updateFormData({ firstName: e.target.value })}
                        className={cn(errors.firstName && 'border-red-300')}
                      />
                      {errors.firstName && (
                        <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="lastName" className="text-sm font-medium">
                        Efternamn *
                      </Label>
                      <Input
                        id="lastName"
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => updateFormData({ lastName: e.target.value })}
                        className={cn(errors.lastName && 'border-red-300')}
                      />
                      {errors.lastName && (
                        <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="email" className="text-sm font-medium">
                  E-postadress *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData({ email: e.target.value })}
                  placeholder="exempel@email.com"
                  className={cn(errors.email && 'border-red-300')}
                />
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-medium">
                  Telefonnummer *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateFormData({ phone: e.target.value })}
                  placeholder="070-123 45 67"
                  className={cn(errors.phone && 'border-red-300')}
                />
                {errors.phone && (
                  <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
                )}
              </div>

              {formData.method === 'manual' && (
                <>
                  <div>
                    <Label htmlFor="password" className="text-sm font-medium">
                      Lösenord *
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => updateFormData({ password: e.target.value })}
                        className={cn(errors.password && 'border-red-300', 'pr-10')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-red-600 mt-1">{errors.password}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">
                      Bekräfta lösenord *
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => updateFormData({ confirmPassword: e.target.value })}
                        className={cn(errors.confirmPassword && 'border-red-300', 'pr-10')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-600 mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Address Information Step */}
          {currentStep === 'address-info' && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Ange din nuvarande adress. Detta används för kommunikation och verifiering.
              </p>

              <div>
                <Label htmlFor="streetAddress" className="text-sm font-medium">
                  Gatuadress *
                </Label>
                <Input
                  id="streetAddress"
                  type="text"
                  value={formData.streetAddress}
                  onChange={(e) => updateFormData({ streetAddress: e.target.value })}
                  placeholder="Exempelgatan 123"
                  className={cn(errors.streetAddress && 'border-red-300')}
                />
                {errors.streetAddress && (
                  <p className="text-sm text-red-600 mt-1">{errors.streetAddress}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="postalCode" className="text-sm font-medium">
                    Postnummer *
                  </Label>
                  <Input
                    id="postalCode"
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => updateFormData({ postalCode: formatSwedishPostalCode(e.target.value) })}
                    placeholder="123 45"
                    className={cn(errors.postalCode && 'border-red-300')}
                    maxLength={6}
                  />
                  {errors.postalCode && (
                    <p className="text-sm text-red-600 mt-1">{errors.postalCode}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="city" className="text-sm font-medium">
                    Ort *
                  </Label>
                  <Input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateFormData({ city: e.target.value })}
                    placeholder="Stockholm"
                    className={cn(errors.city && 'border-red-300')}
                  />
                  {errors.city && (
                    <p className="text-sm text-red-600 mt-1">{errors.city}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Apartment Selection Step */}
          {currentStep === 'apartment-selection' && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Välj den lägenhet du är intresserad av eller redan bor i.
              </p>

              <div className="space-y-3">
                {MOCK_APARTMENTS.map((apartment) => (
                  <div
                    key={apartment.number}
                    className={cn(
                      'p-4 rounded-lg border cursor-pointer transition-colors',
                      apartment.available 
                        ? 'hover:bg-gray-50 border-gray-200' 
                        : 'bg-gray-50 border-gray-100 cursor-not-allowed',
                      formData.apartmentNumber === apartment.number && 'border-blue-500 bg-blue-50'
                    )}
                    onClick={() => apartment.available && updateFormData({ apartmentNumber: apartment.number })}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <Building className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">Lägenhet {apartment.number}</span>
                          </div>
                          <Badge variant={apartment.available ? 'default' : 'secondary'}>
                            {apartment.available ? 'Tillgänglig' : 'Upptagen'}
                          </Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <span>Våning {apartment.floor}</span>
                          <span>{apartment.size}</span>
                          <span>{apartment.rooms}</span>
                          <span>{apartment.fee}</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <RadioGroup
                          value={formData.apartmentNumber}
                          onValueChange={(value) => updateFormData({ apartmentNumber: value })}
                        >
                          <RadioGroupItem 
                            value={apartment.number} 
                            disabled={!apartment.available}
                          />
                        </RadioGroup>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {errors.apartmentNumber && (
                <p className="text-sm text-red-600">{errors.apartmentNumber}</p>
              )}
            </div>
          )}

          {/* Verification Step */}
          {currentStep === 'verification' && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Vi kommer att skicka verifieringskoder till din e-post och telefon.
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">E-postverifiering</p>
                      <p className="text-sm text-gray-600">{formData.email}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">SMS-verifiering</p>
                      <p className="text-sm text-gray-600">{formData.phone}</p>
                    </div>
                  </div>
                </div>

                {formData.method === 'bankid' && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium">BankID-verifierad</p>
                        <p className="text-sm text-gray-600">Din identitet är redan verifierad</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Terms and Conditions Step */}
          {currentStep === 'terms' && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Läs igenom och acceptera följande villkor för att slutföra din registrering.
              </p>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="acceptedTerms"
                    checked={formData.acceptedTerms}
                    onCheckedChange={(checked) => updateFormData({ acceptedTerms: checked === true })}
                    className={cn(errors.acceptedTerms && 'border-red-300')}
                  />
                  <div className="flex-1">
                    <Label htmlFor="acceptedTerms" className="cursor-pointer">
                      Jag accepterar{' '}
                      <a href="/terms" target="_blank" className="text-blue-600 underline">
                        användarvillkoren
                      </a>
                      {' '}*
                    </Label>
                    {errors.acceptedTerms && (
                      <p className="text-sm text-red-600 mt-1">{errors.acceptedTerms}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="acceptedPrivacyPolicy"
                    checked={formData.acceptedPrivacyPolicy}
                    onCheckedChange={(checked) => updateFormData({ acceptedPrivacyPolicy: checked === true })}
                    className={cn(errors.acceptedPrivacyPolicy && 'border-red-300')}
                  />
                  <div className="flex-1">
                    <Label htmlFor="acceptedPrivacyPolicy" className="cursor-pointer">
                      Jag accepterar{' '}
                      <a href="/privacy" target="_blank" className="text-blue-600 underline">
                        integritetspolicyn
                      </a>
                      {' '}*
                    </Label>
                    {errors.acceptedPrivacyPolicy && (
                      <p className="text-sm text-red-600 mt-1">{errors.acceptedPrivacyPolicy}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="acceptedDataProcessing"
                    checked={formData.acceptedDataProcessing}
                    onCheckedChange={(checked) => updateFormData({ acceptedDataProcessing: checked === true })}
                    className={cn(errors.acceptedDataProcessing && 'border-red-300')}
                  />
                  <div className="flex-1">
                    <Label htmlFor="acceptedDataProcessing" className="cursor-pointer">
                      Jag godkänner att mina personuppgifter behandlas enligt GDPR *
                    </Label>
                    {errors.acceptedDataProcessing && (
                      <p className="text-sm text-red-600 mt-1">{errors.acceptedDataProcessing}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="marketingConsent"
                    checked={formData.marketingConsent}
                    onCheckedChange={(checked) => updateFormData({ marketingConsent: checked === true })}
                  />
                  <div className="flex-1">
                    <Label htmlFor="marketingConsent" className="cursor-pointer">
                      Jag vill få information om föreningens aktiviteter och erbjudanden via e-post
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Detta samtycke kan du när som helst återkalla
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Completion Step */}
          {currentStep === 'complete' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-green-600" />
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Registrering slutförd!</h3>
                <p className="text-gray-600 mt-2">
                  Din ansökan om medlemskap har skickats till föreningens styrelse för godkännande.
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-4 text-left">
                <h4 className="font-medium text-green-900 mb-2">Nästa steg:</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Styrelsen kommer att granska din ansökan</li>
                  <li>• Du får ett e-postmeddelande inom 3-5 arbetsdagar</li>
                  <li>• När ansökan godkänns får du tillgång till portalen</li>
                  <li>• Du kan då börja använda alla medlemsfunktioner</li>
                </ul>
              </div>

              <Button
                onClick={() => router.push('/auth/login')}
                className="w-full"
              >
                Gå till inloggning
              </Button>
            </div>
          )}

          {/* Error Display */}
          {errors.submit && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-800">{errors.submit}</p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          {currentStep !== 'complete' && (
            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 'method-selection' || (currentStep === 'address-info' && formData.method === 'bankid')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Tillbaka</span>
              </Button>

              <Button
                type="button"
                onClick={currentStep === 'terms' ? submitRegistration : nextStep}
                disabled={isLoading}
                className="flex items-center space-x-2"
              >
                <span>
                  {currentStep === 'terms' ? 'Slutför registrering' : 'Nästa'}
                </span>
                {currentStep === 'terms' ? (
                  isLoading && <div className="ml-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}