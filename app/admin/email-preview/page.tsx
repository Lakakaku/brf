import { Metadata } from 'next';
import { EmailPreviewPanel } from '@/components/email';

export const metadata: Metadata = {
  title: 'E-postförhandsvisning - BRF Portal Admin',
  description: 'Förhandsgranska och testa e-postmallar för svenska bostadsrättsföreningar',
};

export default function EmailPreviewPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold tracking-tight">E-postförhandsvisning</h1>
          <p className="text-muted-foreground mt-2">
            Förhandsgranska, anpassa och testa e-postmallar för svenska BRF-system.
            Alla mallar är optimerade för bostadsrättsföreningar och följer svenska 
            språk- och kulturkonventioner.
          </p>
        </div>

        {/* Feature Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 border rounded-lg">
            <h3 className="font-semibold text-sm text-blue-600 mb-2">📧 Förhandsvisning</h3>
            <p className="text-sm text-muted-foreground">
              Se hur e-postmallar ser ut med riktiga data. Stöder både HTML- och textformat.
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="font-semibold text-sm text-green-600 mb-2">🔧 Variabelhantering</h3>
            <p className="text-sm text-muted-foreground">
              Testa olika datakombinationer och se live-uppdateringar av mallinnehåll.
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="font-semibold text-sm text-purple-600 mb-2">📤 Testutskick</h3>
            <p className="text-sm text-muted-foreground">
              Skicka testmejl för att kontrollera formatering och leveransbarhet.
            </p>
          </div>
        </div>

        {/* Email Preview Panel */}
        <EmailPreviewPanel />

        {/* Usage Notes */}
        <div className="mt-12 p-6 bg-muted/30 border rounded-lg">
          <h3 className="font-semibold mb-3">Användningsinstruktioner</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">📋 Malltyper</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>E-postverifiering:</strong> För nya medlemsregistreringar</li>
                <li>• <strong>Registrering godkänd:</strong> Välkomstmeddelanden</li>
                <li>• <strong>Lösenordsåterställning:</strong> Säker återställning</li>
                <li>• <strong>Inloggningsnotifiering:</strong> Säkerhetsvarningar</li>
                <li>• <strong>Styrelsemöte:</strong> Mötesanmälan och agenda</li>
                <li>• <strong>Underhållsarbete:</strong> Information om planerat arbete</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">🛠 Funktioner</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>Live-förhandsvisning:</strong> Se ändringar direkt</li>
                <li>• <strong>Responsiv design:</strong> Fungerar på alla enheter</li>
                <li>• <strong>Svenska BRF-anpassningar:</strong> Korrekt terminologi</li>
                <li>• <strong>Variabel substitution:</strong> Dynamiskt innehåll</li>
                <li>• <strong>Mock e-postsystem:</strong> Säker testning</li>
                <li>• <strong>GDPR-kompatibelt:</strong> Svensk dataskydd</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>💡 Tips:</strong> Alla e-postmallar använder svenska språket och är 
              anpassade för svenska bostadsrättsföreningar. Mallarna följer svenska 
              riktlinjer för e-postkommunikation och inkluderar relevanta juridiska krav.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}