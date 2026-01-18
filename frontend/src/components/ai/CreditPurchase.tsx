
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAICredits } from '@/hooks/useAICredits';
import { CreditCard, Zap, Sparkles, Crown, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  originalPrice?: number;
  popular?: boolean;
  icon: React.ReactNode;
  benefits: string[];
  color: string;
}

const CreditPurchase: React.FC = () => {
  const { credits, purchaseCredits, loading } = useAICredits();
  const [purchasing, setPurchasing] = useState(false);
  const [customAmount, setCustomAmount] = useState(1000);

  const packages: CreditPackage[] = [
    {
      id: 'starter',
      name: 'Starter',
      credits: 1000,
      price: 9.99,
      icon: <Zap className="w-6 h-6" />,
      benefits: ['1.000 créditos de IA', 'Suporte básico', 'Válido por 30 dias'],
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'professional',
      name: 'Professional',
      credits: 5000,
      price: 39.99,
      originalPrice: 49.99,
      popular: true,
      icon: <Sparkles className="w-6 h-6" />,
      benefits: ['5.000 créditos de IA', 'Suporte prioritário', 'Válido por 60 dias', '20% de desconto'],
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      credits: 15000,
      price: 99.99,
      originalPrice: 149.99,
      icon: <Crown className="w-6 h-6" />,
      benefits: ['15.000 créditos de IA', 'Suporte 24/7', 'Válido por 90 dias', '33% de desconto', 'Recursos premium'],
      color: 'from-amber-500 to-amber-600'
    },
    {
      id: 'unlimited',
      name: 'Unlimited',
      credits: 50000,
      price: 249.99,
      originalPrice: 399.99,
      icon: <Rocket className="w-6 h-6" />,
      benefits: ['50.000 créditos de IA', 'Suporte dedicado', 'Válido por 120 dias', '37% de desconto', 'Acesso antecipado', 'Consultoria inclusa'],
      color: 'from-emerald-500 to-emerald-600'
    }
  ];

  const handlePurchase = async (pkg: CreditPackage) => {
    setPurchasing(true);
    try {
      await purchaseCredits(pkg.credits, pkg.price);
      toast.success(`✅ ${pkg.credits.toLocaleString()} créditos adquiridos com sucesso!`);
    } catch (error: any) {
      toast.error(`❌ Erro na compra: ${error.message}`);
    } finally {
      setPurchasing(false);
    }
  };

  const handleCustomPurchase = async () => {
    if (customAmount < 100) {
      toast.error('Quantidade mínima é 100 créditos');
      return;
    }

    setPurchasing(true);
    try {
      const price = (customAmount / 100) * 0.99; // $0.99 per 100 credits
      await purchaseCredits(customAmount, price);
      toast.success(`✅ ${customAmount.toLocaleString()} créditos adquiridos com sucesso!`);
    } catch (error: any) {
      toast.error(`❌ Erro na compra: ${error.message}`);
    } finally {
      setPurchasing(false);
    }
  };

  return (
          <PermissionGuard requiredPermissions={['manage_ai_credits']}>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            🚀 Comprar Créditos de IA
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Adquira créditos para usar nossos assistentes de IA avançados. Quanto mais você compra, mais economia você tem!
          </p>
          
          {credits && (
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 px-4 py-2 rounded-full">
              <Zap className="w-4 h-4" />
              <span className="">
                Saldo atual: {credits.credits_remaining.toLocaleString()} créditos
              </span>
            </div>
          )}
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {packages.map((pkg) => (
            <Card key={pkg.id} className={`relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl ${pkg.popular ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}>
              {pkg.popular && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 text-xs rounded-bl-lg">
                  🔥 POPULAR
                </div>
              )}
              
              <CardHeader className="text-center">
                <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-r ${pkg.color} flex items-center justify-center text-white mb-4`}>
                  {pkg.icon}
                </div>
                <CardTitle className="text-xl">{pkg.name}</CardTitle>
                <CardDescription>
                  <div className="space-y-2">
                    {pkg.originalPrice && (
                      <div className="text-sm text-muted-foreground line-through">
                        ${pkg.originalPrice}
                      </div>
                    )}
                    <div className="text-3xl text-foreground">
                      ${pkg.price}
                    </div>
                    <div className="text-sm text-blue-600">
                      {pkg.credits.toLocaleString()} créditos
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {pkg.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      {benefit}
                    </li>
                  ))}
                </ul>
                
                <Button 
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing || loading}
                  className={`w-full bg-gradient-to-r ${pkg.color} hover:opacity-90 text-white border-0`}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {purchasing ? 'Processando...' : 'Comprar Agora'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Custom Amount */}
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Quantidade Personalizada
            </CardTitle>
            <CardDescription>
              Compre a quantidade exata que você precisa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="custom-amount">Quantidade de Créditos</Label>
              <Input
                id="custom-amount"
                type="number"
                min="100"
                step="100"
                value={customAmount}
                onChange={(e) => setCustomAmount(parseInt(e.target.value) || 100)}
                className="text-center text-lg"
              />
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Preço: ${((customAmount / 100) * 0.99).toFixed(2)} • Mínimo: 100 créditos
              </p>
            </div>
            
            <Button 
              onClick={handleCustomPurchase}
              disabled={purchasing || loading || customAmount < 100}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90 text-white"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {purchasing ? 'Processando...' : `Comprar ${customAmount.toLocaleString()} Créditos`}
            </Button>
          </CardContent>
        </Card>

        {/* Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="mb-2">Uso Eficiente</h3>
              <p className="text-sm text-muted-foreground">
                Nossos créditos são otimizados para máxima eficiência. GPT-4 usa 2x mais créditos que GPT-3.5.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="mb-2">Sem Expiração</h3>
              <p className="text-sm text-muted-foreground">
                Seus créditos não expiram! Use quando quiser, no seu próprio ritmo.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="mb-2">Suporte Premium</h3>
              <p className="text-sm text-muted-foreground">
                Suporte prioritário para todos os planos. Estamos aqui para ajudar!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default CreditPurchase;
