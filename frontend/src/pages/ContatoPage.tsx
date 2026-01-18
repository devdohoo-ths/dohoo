import React from 'react';
import { Mail, Phone, MapPin, Send, Clock, HelpCircle } from 'lucide-react';

const ContatoPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header/Nav simples */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl">D</span>
              </div>
              <span className="text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Dohoo
              </span>
            </div>
            <a 
              href="/login" 
              className="text-blue-600 hover:text-blue-700 transition-colors"
            >
              Fazer Login →
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl sm:text-6xl mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Entre em Contato
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Estamos aqui para ajudar! Entre em contato conosco e nossa equipe responderá o mais breve possível.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Card de Informações de Contato */}
          <div className="space-y-6">
            {/* Email */}
            <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Mail className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl text-gray-900 mb-2">Email</h3>
                  <p className="text-gray-600 mb-3">Envie-nos um email a qualquer momento</p>
                  <a 
                    href="mailto:contato@dohoo.com.br" 
                    className="text-blue-600 hover:text-blue-700 text-lg inline-flex items-center gap-2 group"
                  >
                    contato@dohoo.com.br
                    <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>
            </div>

            {/* Telefone */}
            <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Phone className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl text-gray-900 mb-2">Telefone</h3>
                  <p className="text-gray-600 mb-3">Ligue para nós durante o horário comercial</p>
                  <a 
                    href="tel:+551142808088" 
                    className="text-purple-600 hover:text-purple-700 text-lg inline-flex items-center gap-2 group"
                  >
                    +55 11 4280-8088
                    <Phone className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  </a>
                </div>
              </div>
            </div>

            {/* Horário */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-100">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <Clock className="w-7 h-7 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl text-gray-900 mb-2">Horário de Atendimento</h3>
                  <div className="space-y-2 text-gray-700">
                    <p className="flex items-center justify-between">
                      <span className="">Segunda - Sexta:</span>
                      <span>09:00 - 18:00</span>
                    </p>
                    <p className="flex items-center justify-between text-gray-500">
                      <span className="">Sábado - Domingo:</span>
                      <span>Fechado</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card de FAQ Rápido */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <HelpCircle className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl text-gray-900">Perguntas Frequentes</h3>
            </div>

            <div className="space-y-6">
              {/* FAQ 1 */}
              <div className="border-b border-gray-100 pb-6">
                <h4 className="text-gray-900 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">1</span>
                  Como funciona o período de POC?
                </h4>
                <p className="text-gray-600 pl-8">
                  O período de POC (Proof of Concept) permite que você teste nossa plataforma por um período determinado. Você receberá notificações antes do vencimento.
                </p>
              </div>

              {/* FAQ 2 */}
              <div className="border-b border-gray-100 pb-6">
                <h4 className="text-gray-900 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm">2</span>
                  Qual o tempo de resposta?
                </h4>
                <p className="text-gray-600 pl-8">
                  Respondemos todos os contatos em até 24 horas durante dias úteis. Para suporte urgente, ligue para nosso telefone.
                </p>
              </div>

              {/* FAQ 3 */}
              <div className="pb-2">
                <h4 className="text-gray-900 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm">3</span>
                  Vocês oferecem suporte técnico?
                </h4>
                <p className="text-gray-600 pl-8">
                  Sim! Nossa equipe de suporte técnico está disponível para ajudar com qualquer dúvida ou problema que você possa ter.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100">
              <p className="text-gray-700 mb-3">Ainda tem dúvidas?</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="mailto:contato@dohoo.com.br"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                >
                  <Mail className="w-5 h-5" />
                  Enviar Email
                </a>
                <a
                  href="tel:+551142808088"
                  className="flex-1 bg-white hover:bg-gray-50 text-gray-900 py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 border-2 border-gray-200 shadow"
                >
                  <Phone className="w-5 h-5" />
                  Ligar Agora
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer minimalista */}
        <div className="mt-16 pt-8 border-t border-gray-200 text-center">
          <p className="text-gray-600">
            © {new Date().getFullYear()} Dohoo. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContatoPage;

