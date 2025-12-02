import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Person, PersonType, Course } from '@/types';
import { Plus, Loader2, Edit, Trash2, Download, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';

interface PeopleTabProps {
  onDataChange?: () => void;
}

const PeopleTab = ({ onDataChange }: PeopleTabProps) => {
  const { userData } = useAuth();
  const { logAction } = useAuditLog();
  const [people, setPeople] = useState<Person[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [formData, setFormData] = useState({ 
    tipo: 'Professor' as PersonType,
    firstName: '',
    lastName: '',
    login: '', 
    email: '',
    senha: '',
    courseId: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<'all' | PersonType>('all');
  const [uploading, setUploading] = useState(false);
  const [uploadResultOpen, setUploadResultOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [uploadResult, setUploadResult] = useState<{
    created: string[];
    ignored: string[];
    errors: string[];
  }>({ created: [], ignored: [], errors: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPeople();
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'curs-pos-mensal'));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Course[];
      setCourses(data);
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  };

  const loadPeople = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'user-pos'));
      const data = snapshot.docs.map((doc) => {
        const docData = doc.data();
        
        // Normalizar dados - suportar tanto "nome" quanto "firstName/lastName"
        let firstName = docData.firstName || '';
        let lastName = docData.lastName || '';
        
        if (docData.nome && (!firstName || !lastName)) {
          const nameParts = docData.nome.trim().split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }
        
        return {
          id: doc.id,
          tipo: docData.tipo,
          firstName,
          lastName,
          login: docData.login,
          email: docData.email,
          senha: docData.senha,
          courseId: docData.courseId,
          courseName: docData.courseName,
          createdAt: docData.createdAt?.toDate() || new Date(),
        } as Person;
      });
      setPeople(data);
    } catch (error) {
      console.error('Error loading people:', error);
      toast({
        title: 'Erro ao carregar dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Professor não precisa de senha (não faz login)
    if (formData.tipo !== 'Professor' && !formData.senha && !formData.login) {
      toast({
        title: 'Senha obrigatória',
        description: 'Senha é obrigatória para Coordenadores e Tutores',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.tipo || !formData.firstName || !formData.lastName || !formData.login || !formData.email) {
      toast({
        title: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    // Validate course for Tutor only (Coordinators are assigned via Courses tab)
    if (formData.tipo === 'Tutor' && !formData.courseId) {
      toast({
        title: 'Curso obrigatório',
        description: 'Selecione um curso para o Tutor',
        variant: 'destructive',
      });
      return;
    }

    // Validate login is unique
    if (!editingPerson) {
      const loginQuery = query(collection(db, 'user-pos'), where('login', '==', formData.login));
      const loginSnapshot = await getDocs(loginQuery);
      if (!loginSnapshot.empty) {
        toast({
          title: 'Login já existe',
          description: 'Escolha outro login',
          variant: 'destructive',
        });
        return;
      }
    } else {
      // Check if login changed and is unique
      if (formData.login !== editingPerson.login) {
        const loginQuery = query(collection(db, 'user-pos'), where('login', '==', formData.login));
        const loginSnapshot = await getDocs(loginQuery);
        if (!loginSnapshot.empty) {
          toast({
            title: 'Login já existe',
            description: 'Escolha outro login',
            variant: 'destructive',
          });
          return;
        }
      }
    }

    // Validate email is unique
    if (!editingPerson) {
      const emailQuery = query(collection(db, 'user-pos'), where('email', '==', formData.email));
      const emailSnapshot = await getDocs(emailQuery);
      if (!emailSnapshot.empty) {
        toast({
          title: 'Email já existe',
          description: 'Escolha outro email',
          variant: 'destructive',
        });
        return;
      }
    } else {
      // Check if email changed and is unique
      if (formData.email !== editingPerson.email) {
        const emailQuery = query(collection(db, 'user-pos'), where('email', '==', formData.email));
        const emailSnapshot = await getDocs(emailQuery);
        if (!emailSnapshot.empty) {
          toast({
            title: 'Email já existe',
            description: 'Escolha outro email',
            variant: 'destructive',
          });
          return;
        }
      }
    }

    setSaving(true);
    try {
      const selectedCourse = courses.find(c => c.id === formData.courseId);
      const personData: any = {
        tipo: formData.tipo,
        firstName: formData.firstName,
        lastName: formData.lastName,
        login: formData.login,
        email: formData.email,
      };

      // Senha apenas para quem faz login (não para professores)
      if (formData.tipo !== 'Professor') {
        personData.senha = formData.senha || formData.login;
      }

      // Add course info for Tutor only (Coordinators are assigned via Courses tab)
      if (formData.tipo === 'Tutor') {
        personData.courseId = formData.courseId;
        personData.courseName = selectedCourse?.name || '';
      }

      if (editingPerson) {
        await updateDoc(doc(db, 'user-pos', editingPerson.id), personData);
        
        // Log audit
        if (userData) {
          await logAction(
            userData.id,
            userData.email,
            'update',
            'person',
            editingPerson.id,
            `${formData.firstName} ${formData.lastName}`,
            {
              tipo: { before: editingPerson.tipo, after: formData.tipo },
              firstName: { before: editingPerson.firstName, after: formData.firstName },
              lastName: { before: editingPerson.lastName, after: formData.lastName },
              login: { before: editingPerson.login, after: formData.login },
              email: { before: editingPerson.email, after: formData.email },
            }
          );
        }
        
        toast({ title: `${formData.tipo} atualizado com sucesso!` });
        onDataChange?.();
      } else {
        const docRef = await addDoc(collection(db, 'user-pos'), {
          ...personData,
          createdAt: Timestamp.now(),
        });
        
        // Log audit
        if (userData) {
          await logAction(
            userData.id,
            userData.email,
            'create',
            'person',
            docRef.id,
            `${formData.firstName} ${formData.lastName}`
          );
        }
        
        toast({ title: `${formData.tipo} criado com sucesso!` });
        onDataChange?.();
      }
      
      setDialogOpen(false);
      setFormData({ tipo: 'Professor', firstName: '', lastName: '', email: '', login: '', senha: '', courseId: '' });
      setEditingPerson(null);
      loadPeople();
    } catch (error) {
      console.error('Error saving person:', error);
      toast({
        title: 'Erro ao salvar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (person: Person) => {
    setEditingPerson(person);
    setFormData({
      tipo: person.tipo,
      firstName: person.firstName,
      lastName: person.lastName,
      login: person.login,
      email: person.email,
      senha: person.senha,
      courseId: person.courseId || '',
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (person: Person) => {
    setPersonToDelete(person);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!personToDelete) return;

    try {
      await deleteDoc(doc(db, 'user-pos', personToDelete.id));
      
      // Log audit
      if (userData) {
        await logAction(
          userData.id,
          userData.email,
          'delete',
          'person',
          personToDelete.id,
          `${personToDelete.firstName} ${personToDelete.lastName}`
        );
      }
      
      toast({ title: 'Excluído com sucesso!' });
      onDataChange?.();
      loadPeople();
      setDeleteDialogOpen(false);
      setPersonToDelete(null);
    } catch (error) {
      console.error('Error deleting person:', error);
      toast({
        title: 'Erro ao excluir',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingPerson(null);
    setFormData({ tipo: 'Professor', firstName: '', lastName: '', email: '', login: '', senha: '', courseId: '' });
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { 'Tipo': 'Professor', 'First Name': 'Maria', 'Last Name': 'Silva', 'Email': 'maria.silva@universidade.br', 'Login': 'maria.silva', 'Curso': '' },
      { 'Tipo': 'Coordenador', 'First Name': 'João', 'Last Name': 'Santos', 'Email': 'joao.santos@universidade.br', 'Login': 'joao.santos', 'Curso': '(atribuir na aba Cursos)' },
      { 'Tipo': 'Tutor', 'First Name': 'Ana', 'Last Name': 'Costa', 'Email': 'ana.costa@universidade.br', 'Login': 'ana.costa', 'Curso': 'MBA em Marketing' },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 35 }, { wch: 18 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Usuários');
    XLSX.writeFile(wb, 'template_usuarios.xlsx');
    toast({ title: 'Template baixado com sucesso!' });
  };

  const handleExport = () => {
    const exportData = people.map(p => ({
      'Tipo': p.tipo,
      'First Name': p.firstName,
      'Last Name': p.lastName,
      'Email': p.email,
      'Login': p.login,
      'Curso': p.courseName || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 35 }, { wch: 18 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Usuários');
    XLSX.writeFile(wb, `usuarios_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Dados exportados com sucesso!' });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        toast({ title: 'Planilha vazia', variant: 'destructive' });
        return;
      }

      setPreviewData(jsonData);
      setPreviewOpen(true);
    } catch (error) {
      console.error('Error reading file:', error);
      toast({ title: 'Erro ao ler arquivo', variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    setUploading(true);
    setPreviewOpen(false);
    const result = { created: [] as string[], ignored: [] as string[], errors: [] as string[] };
    
    try {
      const peopleSnapshot = await getDocs(collection(db, 'user-pos'));
      const existingLogins = new Set(
        peopleSnapshot.docs.map(doc => doc.data().login.toLowerCase())
      );

      const coursesByName = new Map(
        courses.map(c => [c.name.toLowerCase(), c])
      );

      let rowNum = 1;

      for (const row of previewData) {
        rowNum++;
        try {
          const tipo = row['Tipo']?.trim();
          const firstName = row['First Name']?.trim();
          const lastName = row['Last Name']?.trim();
          const email = row['Email']?.trim();
          const login = row['Login']?.trim();
          const courseName = row['Curso']?.trim();
          
          if (!tipo || !firstName || !lastName || !login || !email) {
            result.errors.push(`Linha ${rowNum}: Campos obrigatórios faltando`);
            continue;
          }

          if (tipo !== 'Professor' && tipo !== 'Coordenador' && tipo !== 'Tutor' && tipo !== 'Administrador') {
            result.errors.push(`Linha ${rowNum}: Tipo inválido`);
            continue;
          }

          if (existingLogins.has(login.toLowerCase())) {
            result.ignored.push(`Linha ${rowNum}: Login "${login}" já existe`);
            continue;
          }

          const personData: any = {
            tipo: tipo as PersonType,
            firstName,
            lastName,
            login,
            email,
            senha: login,
            createdAt: Timestamp.now(),
          };

          // Adicionar curso se for Tutor (Coordenadores são atribuídos via aba Cursos)
          if (tipo === 'Tutor' && courseName) {
            const course = coursesByName.get(courseName.toLowerCase());
            if (course) {
              personData.courseId = course.id;
              personData.courseName = course.name;
            }
          }

          await addDoc(collection(db, 'user-pos'), personData);
          existingLogins.add(login.toLowerCase());
          result.created.push(`${tipo}: ${firstName} ${lastName}`);
        } catch (error) {
          console.error(`Error processing row ${rowNum}:`, error);
          result.errors.push(`Linha ${rowNum}: Erro ao processar`);
        }
      }

      setUploadResult(result);
      setUploadResultOpen(true);
      setPreviewData([]);
      onDataChange?.();
      loadPeople();
    } catch (error) {
      console.error('Error uploading:', error);
      toast({ title: 'Erro ao importar', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const filteredPeople = (filterType === 'all' 
    ? people 
    : people.filter(p => p.tipo === filterType)
  ).filter(p => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(search) ||
      p.lastName.toLowerCase().includes(search) ||
      p.email.toLowerCase().includes(search) ||
      p.login.toLowerCase().includes(search) ||
      p.courseName?.toLowerCase().includes(search)
    );
  });

  const stats = {
    total: people.length,
    professors: people.filter(p => p.tipo === 'Professor').length,
    coordinators: people.filter(p => p.tipo === 'Coordenador').length,
    tutors: people.filter(p => p.tipo === 'Tutor').length,
  };

  const showCourseField = formData.tipo === 'Tutor';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Professores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats.professors}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Coordenadores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">{stats.coordinators}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tutores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{stats.tutors}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Professores, Coordenadores & Tutores</CardTitle>
              <CardDescription>
                Gerencie o cadastro de usuários da pós-graduação
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Template
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />Importar Excel</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleDialogClose()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Pessoa
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingPerson ? 'Editar Cadastro' : 'Novo Cadastro'}
                  </DialogTitle>
                  <DialogDescription>
                    Preencha todos os dados. Senha padrão = Login
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo *</Label>
                    <Select
                      value={formData.tipo}
                      onValueChange={(value) => setFormData({ ...formData, tipo: value as PersonType, courseId: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Professor">Professor</SelectItem>
                        <SelectItem value="Coordenador">Coordenador</SelectItem>
                        <SelectItem value="Tutor">Tutor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="Ex: Maria"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="Ex: Silva"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login">Login *</Label>
                    <Input
                      id="login"
                      value={formData.login}
                      onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                      placeholder="Ex: maria.silva"
                      required
                      disabled={!!editingPerson}
                    />
                    {editingPerson && (
                      <p className="text-xs text-muted-foreground">
                        O login não pode ser alterado após o cadastro
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Ex: maria.silva@universidade.br"
                      required
                    />
                  </div>

                  {formData.tipo !== 'Professor' && (
                    <div className="space-y-2">
                      <Label htmlFor="senha">Senha (padrão: igual ao login)</Label>
                      <Input
                        id="senha"
                        type="password"
                        value={formData.senha}
                        onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                        placeholder="Digite a senha ou deixe em branco para usar o login"
                      />
                      <p className="text-xs text-muted-foreground">
                        Professores não precisam de senha pois não fazem login no sistema
                      </p>
                    </div>
                  )}

                  {showCourseField && (
                    <div className="space-y-2">
                      <Label htmlFor="courseId">Curso * (obrigatório para Tutor)</Label>
                      <Select
                        value={formData.courseId}
                        onValueChange={(value) => setFormData({ ...formData, courseId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um curso" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.map((course) => (
                            <SelectItem key={course.id} value={course.id}>
                              {course.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Coordenadores são atribuídos aos cursos na aba "Cursos" (podem ter até 8 cursos)
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDialogClose}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar'
                      )}
                    </Button>
                  </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <Input
              placeholder="Buscar por nome, email, login ou curso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <div className="flex gap-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
              >
                Todos ({stats.total})
              </Button>
            <Button
              variant={filterType === 'Professor' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Professor')}
            >
              Professores ({stats.professors})
            </Button>
            <Button
              variant={filterType === 'Coordenador' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Coordenador')}
            >
              Coordenadores ({stats.coordinators})
            </Button>
            <Button
              variant={filterType === 'Tutor' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Tutor')}
            >
              Tutores ({stats.tutors})
            </Button>
            </div>
          </div>

          <div className="space-y-2">
            {filteredPeople.map((person) => (
              <div
                key={person.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{person.firstName} {person.lastName} ({person.login})</h3>
                    <Badge variant="outline">{person.tipo}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {person.email}
                  </p>
                  {person.courseName && (
                    <p className="text-sm text-muted-foreground">
                      Curso: {person.courseName}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(person)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(person)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {filteredPeople.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma pessoa cadastrada ainda.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Pré-visualização dos Dados</DialogTitle>
            <DialogDescription>
              {previewData.length} registro(s) encontrado(s). Confirme para importar.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Curso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Badge variant="outline">{row['Tipo'] || '-'}</Badge>
                    </TableCell>
                    <TableCell>{row['First Name'] || '-'}</TableCell>
                    <TableCell>{row['Last Name'] || '-'}</TableCell>
                    <TableCell className="text-sm">{row['Email'] || '-'}</TableCell>
                    <TableCell>{row['Login'] || '-'}</TableCell>
                    <TableCell className="text-sm">{row['Curso'] || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmImport}>
              Confirmar Importação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={uploadResultOpen} onOpenChange={setUploadResultOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resultado da Importação de Usuários</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {uploadResult.created.length > 0 && (
              <div>
                <h4 className="font-medium text-secondary mb-2">✓ Criados ({uploadResult.created.length})</h4>
                <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                  {uploadResult.created.map((item, i) => (
                    <li key={i} className="text-muted-foreground">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {uploadResult.ignored.length > 0 && (
              <div>
                <h4 className="font-medium text-warning mb-2">⚠ Ignorados ({uploadResult.ignored.length})</h4>
                <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                  {uploadResult.ignored.map((item, i) => (
                    <li key={i} className="text-muted-foreground">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {uploadResult.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-destructive mb-2">✗ Erros ({uploadResult.errors.length})</h4>
                <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                  {uploadResult.errors.map((item, i) => (
                    <li key={i} className="text-muted-foreground">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setUploadResultOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{personToDelete?.firstName} {personToDelete?.lastName}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PeopleTab;
