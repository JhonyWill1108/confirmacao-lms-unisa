import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { collection, addDoc, Timestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ExcelRow {
  Curso?: string;
  Disciplina?: string;
  'Login Coordenador'?: string;
  'Login Professor'?: string;
  'Login Tutor'?: string;
  'Mês 1'?: string;
  'Mês 2'?: string;
  [key: string]: any;
}

interface UploadTabProps {
  onDataChange?: () => void;
}

const UploadTab = ({ onDataChange }: UploadTabProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; errors: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    // Criar dados de exemplo para a planilha modelo
    const templateData = [
      {
        Curso: 'Mestrado em Ciência da Computação',
        Disciplina: 'Inteligência Artificial Avançada',
        'Login Coordenador': 'joao.silva',
        'Login Professor': 'maria.santos',
        'Login Tutor': 'carlos.oliveira',
        'Mês 1': '2025-03',
        'Mês 2': '2025-04',
      },
      {
        Curso: 'MBA em Marketing Digital',
        Disciplina: 'Marketing de Conteúdo',
        'Login Coordenador': '',
        'Login Professor': '',
        'Login Tutor': '',
        'Mês 1': '2025-05',
        'Mês 2': '',
      },
    ];

    // Criar workbook e worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 40 }, // Curso
      { wch: 40 }, // Disciplina
      { wch: 20 }, // Login Coordenador
      { wch: 20 }, // Login Professor
      { wch: 20 }, // Login Tutor
      { wch: 12 }, // Mês 1
      { wch: 12 }, // Mês 2
    ];

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Disciplinas');

    // Gerar e baixar o arquivo
    XLSX.writeFile(wb, 'planilha_modelo_disciplinas.xlsx');

    toast({
      title: 'Planilha modelo baixada!',
      description: 'Preencha a planilha com Curso e Disciplina (obrigatórios). Os outros campos são opcionais.',
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];

      // Carregar todos os usuários para vincular pelos logins
      const usersSnapshot = await getDocs(collection(db, 'user-pos'));
      const usersByLogin = new Map();
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (userData.login) {
          usersByLogin.set(userData.login.toLowerCase().trim(), {
            id: doc.id,
            ...userData
          });
        }
      });

      // Carregar todos os cursos
      const coursesSnapshot = await getDocs(collection(db, 'curs-pos-mensal'));
      const coursesByName = new Map();
      coursesSnapshot.docs.forEach(doc => {
        const courseData = doc.data();
        if (courseData.name) {
          coursesByName.set(courseData.name.toLowerCase().trim(), {
            id: doc.id,
            ...courseData
          });
        }
      });

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData) {
        try {
          // Validar campos obrigatórios
          const curso = row.Curso?.trim();
          const disciplina = row.Disciplina?.trim();
          
          if (!curso || !disciplina) {
            console.warn('Linha ignorada - Curso e Disciplina são obrigatórios:', row);
            errorCount++;
            continue;
          }

          // Campos opcionais
          const loginCoordenador = row['Login Coordenador']?.trim() || '';
          const loginProfessor = row['Login Professor']?.trim() || '';
          const loginTutor = row['Login Tutor']?.trim() || '';
          const mes1 = row['Mês 1']?.trim() || '';
          const mes2 = row['Mês 2']?.trim() || '';

          // Buscar curso
          const courseData = coursesByName.get(curso.toLowerCase());
          
          if (!courseData) {
            console.warn('Curso não encontrado:', curso);
            errorCount++;
            continue;
          }

          // Criar disciplina
          await addDoc(collection(db, 'disc-pos-mensal'), {
            name: disciplina,
            courseIds: [courseData.id],
            courseNames: [courseData.name],
            coordinatorLogin: loginCoordenador,
            professorLogin: loginProfessor,
            tutorLogin: loginTutor,
            'mes-1': mes1,
            'mes-2': mes2,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

          successCount++;
        } catch (error) {
          console.error('Error processing row:', error, row);
          errorCount++;
        }
      }

      setUploadResult({ success: successCount, errors: errorCount });

      if (successCount > 0) {
        toast({
          title: 'Upload concluído!',
          description: `${successCount} disciplina(s) foram importadas com sucesso.`,
        });
      }

      if (errorCount > 0) {
        toast({
          title: 'Alguns registros falharam',
          description: `${errorCount} registros não puderam ser importados.`,
          variant: 'destructive',
        });
      }

      // Record upload history
      await addDoc(collection(db, 'upload_history'), {
        fileName: file.name,
        uploadedBy: 'admin',
        uploadedAt: Timestamp.now(),
        recordsCount: successCount,
        month: new Date().toISOString().substring(0, 7),
      });
      
      onDataChange?.();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível processar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload de Planilha</CardTitle>
          <CardDescription>
            Faça upload do arquivo Excel com as disciplinas do próximo mês
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Formato esperado:</strong> A planilha deve conter as colunas "Curso" e "Disciplina" (obrigatórios).
              Campos opcionais: "Login Coordenador", "Login Professor", "Login Tutor", "Mês 1" e "Mês 2".
              Os meses devem estar no formato YYYY-MM (ex: 2025-03).
            </AlertDescription>
          </Alert>

          <div className="flex justify-center">
            <Button
              onClick={handleDownloadTemplate}
              variant="outline"
              className="gap-2"
              type="button"
            >
              <Download className="h-4 w-4" />
              Baixar Planilha Modelo
            </Button>
          </div>

          <div className="border-2 border-dashed rounded-lg p-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-primary/10 rounded-full">
                <FileSpreadsheet className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Selecione o arquivo Excel</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Arquivo .xlsx ou .xls com os dados das disciplinas
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Selecionar Arquivo
                  </>
                )}
              </Button>
            </div>
          </div>

          {uploadResult && (
            <Alert className={uploadResult.errors === 0 ? 'border-secondary' : 'border-warning'}>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p>
                    <strong>Resultado do upload:</strong>
                  </p>
                  <p className="text-sm">✓ {uploadResult.success} registros importados</p>
                  {uploadResult.errors > 0 && (
                    <p className="text-sm">✗ {uploadResult.errors} registros com erro</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instruções</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Clique em "Baixar Planilha Modelo" para obter o template</li>
            <li>Preencha a planilha Excel:</li>
            <ul className="list-disc list-inside ml-6 space-y-1">
              <li><strong>Obrigatórios:</strong> Curso, Disciplina</li>
              <li><strong>Opcionais:</strong> Login Coordenador, Login Professor, Login Tutor, Mês 1, Mês 2</li>
            </ul>
            <li>Os meses devem estar no formato YYYY-MM (exemplo: 2025-03)</li>
            <li>Clique em "Selecionar Arquivo" e escolha o arquivo preenchido</li>
            <li>Aguarde o processamento - as disciplinas serão importadas automaticamente</li>
            <li>Após o upload, você pode editar manualmente os campos que ficaram em branco</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default UploadTab;
