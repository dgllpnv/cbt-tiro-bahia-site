import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  MessageCircle,
  Info,
  Clock,
  Target as TargetIcon,
  Crosshair,
  CheckCircle2,
  ChevronRight,
  ListChecks,
  Award,
  X,
  Maximize2,
} from 'lucide-react';

// =====================================================
// Courses — Cursos oficialmente oferecidos pelo CBT.
// Apenas os 4 cursos com cronograma documentado pelo clube sao listados.
// "Eventos especiais e workshops com parceiros" sao mencionados na nota
// final mas nao tem card proprio (evita inventar dados).
// Cada card abre um Dialog com a ficha completa: cronograma, carga horaria,
// arma/calibre, qtd de tiros e pre-requisitos. CTA conduz ao WhatsApp para
// inscricao (clube nao expoe valores publicamente).
// =====================================================

const WHATSAPP_URL =
  'https://wa.me/557130511111?text=' +
  encodeURIComponent('Olá! Tenho interesse em saber mais sobre os cursos do CBT.');

interface Course {
  id: string;
  title: string;
  shortTitle: string;
  tagline: string;
  image: string;
  highlight?: boolean;
  badge?: string;
  description?: string[];
  phases?: { title: string; description: string }[];
  cronograma: string[];
  specs: {
    duracao: string;
    tiros?: string;
    arma?: string;
    alvos?: string;
    prerequisito?: string;
  };
}

// Cursos extras: titulo + imagem, sem detalhes. Mistura entre cursos CBT
// (Tiro para Mulher, Basico de Tiro) e eventos realizados no clube com
// parceiros (Combate Veicular/Velado/com Facas, Urban Survival, etc.)
const otherCourses: Array<{ title: string; image: string }> = [
  { title: 'Curso Básico de Tiro', image: '/site/cursos/curso_basico_tiro2.png' },
  { title: 'Tiro para Mulher', image: '/site/cursos/curso_tiro_para_mulher.avif' },
  { title: 'Combate Veicular', image: '/site/cursos/curso_combate-veicular.png' },
  { title: 'Combate Velado', image: '/site/cursos/curso_combate-velado.png' },
  { title: 'Combate com Facas', image: '/site/cursos/curso_combate_com_facas.png' },
  { title: 'Violência Urbana', image: '/site/cursos/curso_violencia_urbana.png' },
  { title: 'Urban Survival', image: '/site/cursos/curso_urban_survivor.png' },
];

const courses: Course[] = [
  {
    id: 'pistola-revolver',
    title: 'Curso Básico — Pistola e Revólver',
    shortTitle: 'Pistola e Revólver',
    tagline: 'Introdução completa ao manuseio de armas curtas',
    image: '/site/cursos/curso_pistola_e_revolver.avif',
    highlight: true,
    badge: 'Mais Procurado',
    description: [
      'Indicado aos iniciantes na prática do tiro — pessoas que nunca tiveram contato com armas de fogo, ou que já manusearam, mas estão em busca de mais informações e aprimoramento.',
      'Também indicado aos atiradores que não praticam o tiro há muito tempo e querem atualizar seus conhecimentos.',
      'Em um só curso, o aluno aprende a manusear e atirar com duas armas distintas — o revólver e a pistola — e compara vantagens e desvantagens de cada armamento, de forma totalmente didática e segura.',
    ],
    phases: [
      {
        title: 'Etapa teórica',
        description: 'Realizada em sala de aula, abordando todos os preceitos de regras de segurança e apresentação das armas.',
      },
      {
        title: 'Etapa prática',
        description: 'Realizada no estande aberto, com exercícios de tiro real com revólver e pistola, em séries de tiro em diferentes distâncias.',
      },
    ],
    cronograma: [
      'Regras de segurança',
      'Funcionamento de pistola e revólver',
      'Princípios básicos para tiro',
      'Cartucho',
      'Manutenção',
      'Técnicas de tiro (ajoelhado e de pé)',
      'Noções básicas da legislação',
    ],
    specs: {
      duracao: '10 horas',
      tiros: '60 por aluno',
      arma: 'Pistola cal. .380 ACP · Revólver cal. .38 SPL',
    },
  },
  {
    id: 'espingarda-pump',
    title: 'Curso Básico — Espingarda Pump',
    shortTitle: 'Espingarda Pump',
    tagline: 'Operação e segurança em espingardas de ação manual',
    image: '/site/cursos/curso_espingarda.avif',
    cronograma: [
      'Regras de segurança',
      'Dispositivos de segurança (CBC / BOITO)',
      'Principais partes da espingarda',
      'Funcionamento da espingarda',
      'Sistema de percussão',
      'Tipos de munições utilizadas',
      'Cartuchos — características e cuidados',
      'Manutenção (montagem / desmontagem)',
      'Técnicas de tiro',
      'Tiros com e sem visada — visão primária e periférica',
      'Fundamentos do tiro para emprego em espingardas',
    ],
    specs: {
      duracao: '4 horas',
      tiros: '30 por aluno',
      arma: 'Espingarda cal. 12',
    },
  },
  {
    id: 'idsc',
    title: 'Curso Básico — IDSC',
    shortTitle: 'IDSC',
    tagline: 'Tiro prático esportivo em múltiplos alvos e movimento',
    image: '/site/cursos/curso_basico_idsc.avif',
    badge: 'Avançado',
    cronograma: [
      'Tiro prático',
      'IDSC',
      'Modalidades',
      'Nomenclatura dos responsáveis pela prova',
      'Regulamentos e normas de segurança',
      'Legislação básica',
      'Equipamentos e acessórios',
      'Técnicas de tiro',
      'Pistas de tiro',
      'Tiros rápidos',
      'Tiros em alvos múltiplos',
      'Tiros em movimento',
    ],
    specs: {
      duracao: '12 horas',
      tiros: 'A definir',
      arma: 'Pistola ou revólver',
      alvos: 'Papel',
      prerequisito: 'Possuir curso de tiro com pistola',
    },
  },
  {
    id: 'recarga',
    title: 'Curso Básico — Recarga',
    shortTitle: 'Recarga',
    tagline: 'Fabricação artesanal de munição com técnicas e segurança',
    image: '/site/cursos/curso_basico_recarga.avif',
    badge: 'Especializado',
    cronograma: [
      'Regras de segurança',
      'Equipamentos e acessórios',
      'Tipos de pólvora e projétil',
      'Técnicas de recarga',
      'Tabelas balísticas',
      'Noções básicas da legislação',
    ],
    specs: {
      duracao: '8 horas',
      prerequisito: 'Possuir CR de Atirador',
    },
  },
];

const Courses = () => {
  const [openCourse, setOpenCourse] = useState<Course | null>(null);
  // Lightbox para imagens de "Outros cursos" — sem cronograma, apenas
  // ampliacao da imagem promocional do curso/evento.
  const [previewImage, setPreviewImage] = useState<{ image: string; title: string } | null>(null);

  // ESC fecha o lightbox de imagem
  useEffect(() => {
    if (!previewImage) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewImage(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [previewImage]);

  return (
    <section id="cursos" className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-military font-bold text-white mb-4">
              NOSSOS <span className="text-cbt-orange">CURSOS</span>
            </h2>
            <div className="w-24 h-1 bg-cbt-orange mx-auto mb-8"></div>
            <p className="text-xl text-gray-300 font-tactical max-w-3xl mx-auto">
              Programas estruturados para todos os níveis. Clique em qualquer curso para ver cronograma
              completo, carga horária e detalhes técnicos.
            </p>
          </div>

          {/* Courses Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {courses.map((course) => (
              <article
                key={course.id}
                className={`group relative bg-gray-900/50 border rounded-lg overflow-hidden tactical-shadow transition-all duration-300 hover:-translate-y-1 ${
                  course.highlight
                    ? 'border-cbt-orange/50 ring-2 ring-cbt-orange/30'
                    : 'border-gray-700 hover:border-cbt-orange/60'
                }`}
              >
                {/* Image with overlay */}
                <div className="relative h-56 bg-gray-800 overflow-hidden">
                  <img
                    src={course.image}
                    alt={course.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

                  {/* Badge */}
                  {course.badge && (
                    <div className="absolute top-3 right-3">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-tactical font-bold uppercase tracking-wider shadow-lg ${
                          course.highlight
                            ? 'bg-cbt-orange text-black'
                            : 'bg-black/80 text-cbt-orange border border-cbt-orange/40'
                        }`}
                      >
                        {course.badge}
                      </span>
                    </div>
                  )}

                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-2xl font-military font-bold text-white mb-1 leading-tight">
                      {course.shortTitle}
                    </h3>
                    <p className="text-gray-300 font-tactical text-sm">{course.tagline}</p>
                  </div>
                </div>

                {/* Specs bar */}
                <div className="px-5 py-3 border-b border-gray-800 bg-black/40 flex items-center gap-4 flex-wrap text-xs font-tactical">
                  <span className="flex items-center gap-1.5 text-gray-300">
                    <Clock className="w-3.5 h-3.5 text-cbt-orange" />
                    {course.specs.duracao}
                  </span>
                  {course.specs.tiros && (
                    <span className="flex items-center gap-1.5 text-gray-300">
                      <TargetIcon className="w-3.5 h-3.5 text-cbt-orange" />
                      {course.specs.tiros}
                    </span>
                  )}
                  {course.specs.arma && (
                    <span className="flex items-center gap-1.5 text-gray-400 truncate">
                      <Crosshair className="w-3.5 h-3.5 text-cbt-orange flex-shrink-0" />
                      <span className="truncate">{course.specs.arma}</span>
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="p-5 flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => setOpenCourse(course)}
                    variant="outline"
                    className="flex-1 border-cbt-orange/40 text-cbt-orange hover:bg-cbt-orange hover:text-black font-tactical font-bold uppercase tracking-wide transition-all"
                  >
                    <ListChecks className="w-4 h-4 mr-2" />
                    Ver detalhes
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button
                    asChild
                    className="flex-1 font-tactical font-bold uppercase tracking-wide bg-cbt-orange hover:bg-cbt-orange/90 text-black glow-orange"
                  >
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Inscrever-se
                    </a>
                  </Button>
                </div>

                {course.specs.prerequisito && (
                  <div className="px-5 pb-4 -mt-1">
                    <div className="flex items-center gap-2 text-xs font-tactical text-yellow-500/90 bg-yellow-500/5 border border-yellow-500/20 rounded px-3 py-1.5">
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        Pré-requisito: <strong>{course.specs.prerequisito}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>

          {/* Outros cursos ofertados — vitrine sem detalhes (CBT direto + eventos com parceiros) */}
          <div className="mt-16">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cbt-orange/40 to-transparent"></div>
              <span className="text-cbt-orange font-tactical text-xs uppercase tracking-widest font-bold">
                Outros cursos e eventos ofertados
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-cbt-orange/40 via-transparent to-transparent"></div>
            </div>
            <p className="text-center text-gray-400 font-tactical text-sm max-w-2xl mx-auto mb-8">
              Cursos especiais, treinamentos avançados e eventos com parceiros realizados no CBT.
              Datas, valores e vagas pelo WhatsApp.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {otherCourses.map((c) => (
                <article
                  key={c.title}
                  className="group relative bg-gray-900/50 border border-gray-700 hover:border-cbt-orange/60 rounded-lg overflow-hidden tactical-shadow transition-all duration-300 hover:-translate-y-1"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewImage({ image: c.image, title: c.title })}
                    className="block relative aspect-square bg-gray-800 overflow-hidden w-full cursor-zoom-in"
                    aria-label={`Ampliar imagem do curso ${c.title}`}
                  >
                    <img
                      src={c.image}
                      alt={c.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent pointer-events-none"></div>
                    <div className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none">
                      <h4 className="text-white font-military font-bold text-sm md:text-base leading-tight">
                        {c.title}
                      </h4>
                    </div>
                  </button>
                  <div className="p-3">
                    <Button
                      asChild
                      size="sm"
                      className="w-full bg-cbt-orange/90 hover:bg-cbt-orange text-black font-tactical font-bold uppercase tracking-wide text-xs"
                    >
                      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                        Saber mais
                      </a>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Bottom note + CTA */}
          <div className="mt-12 p-6 bg-gradient-to-r from-cbt-orange/10 via-gray-800/40 to-cbt-orange/10 rounded-lg border border-cbt-orange/20">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 bg-cbt-orange/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Info className="w-6 h-6 text-cbt-orange" />
              </div>
              <div>
                <h4 className="text-white font-military font-bold text-lg mb-2">
                  Informações importantes
                </h4>
                <ul className="text-gray-300 font-tactical text-sm space-y-1.5">
                  <li>• Cursos destinados <strong>somente a maiores de 18 anos</strong></li>
                  <li>
                    • No valor dos cursos <strong>não estão inclusas</strong> munições, alvos, uso de armas e
                    estande, materiais de segurança e proteção individual
                  </li>
                  <li>
                    • <strong>Eventos especiais</strong> e workshops com parceiros são divulgados na seção de
                    notícias
                  </li>
                </ul>
              </div>
            </div>
            <div className="text-center pt-4 border-t border-cbt-orange/20">
              <Button
                asChild
                size="lg"
                className="bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold uppercase tracking-wide glow-orange transition-all duration-300 hover:scale-105"
              >
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Falar com a equipe pelo WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Image Lightbox (outros cursos) ─────────────────────────────── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 md:top-6 md:right-6 text-white hover:text-cbt-orange p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all z-10"
            aria-label="Fechar"
          >
            <X size={28} />
          </button>
          <div
            className="relative max-w-5xl w-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage.image}
              alt={previewImage.title}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <p className="mt-4 text-center text-white font-military text-lg md:text-xl px-4">
              {previewImage.title}
            </p>
          </div>
        </div>
      )}

      {/* ── Detail Dialog ──────────────────────────────────────────────── */}
      <Dialog open={openCourse !== null} onOpenChange={(o) => !o && setOpenCourse(null)}>
        <DialogContent className="bg-gray-900 border-cbt-orange/30 text-white max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {openCourse && (
            <>
              {/* Hero image */}
              <div className="relative h-56 md:h-64 bg-black overflow-hidden">
                <img
                  src={openCourse.image}
                  alt={openCourse.title}
                  className="w-full h-full object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  {openCourse.badge && (
                    <span className="inline-block mb-3 px-3 py-1 rounded-full bg-cbt-orange text-black text-[10px] font-tactical font-bold uppercase tracking-wider">
                      {openCourse.badge}
                    </span>
                  )}
                  <DialogHeader>
                    <DialogTitle className="text-2xl md:text-3xl font-military font-bold text-white">
                      {openCourse.title}
                    </DialogTitle>
                    <DialogDescription className="text-gray-300 font-tactical text-base mt-1">
                      {openCourse.tagline}
                    </DialogDescription>
                  </DialogHeader>
                </div>
              </div>

              <div className="px-6 py-5 space-y-6">
                {/* Specs row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-black/60 border border-gray-800 rounded-lg p-3 text-center">
                    <Clock className="w-5 h-5 text-cbt-orange mx-auto mb-1" />
                    <div className="text-[10px] font-tactical uppercase text-gray-500 tracking-wider">
                      Carga horária
                    </div>
                    <div className="text-white font-military font-bold text-sm mt-0.5">
                      {openCourse.specs.duracao}
                    </div>
                  </div>
                  {openCourse.specs.tiros && (
                    <div className="bg-black/60 border border-gray-800 rounded-lg p-3 text-center">
                      <TargetIcon className="w-5 h-5 text-cbt-orange mx-auto mb-1" />
                      <div className="text-[10px] font-tactical uppercase text-gray-500 tracking-wider">
                        Disparos
                      </div>
                      <div className="text-white font-military font-bold text-sm mt-0.5">
                        {openCourse.specs.tiros}
                      </div>
                    </div>
                  )}
                  {openCourse.specs.arma && (
                    <div className="bg-black/60 border border-gray-800 rounded-lg p-3 text-center col-span-2">
                      <Crosshair className="w-5 h-5 text-cbt-orange mx-auto mb-1" />
                      <div className="text-[10px] font-tactical uppercase text-gray-500 tracking-wider">
                        Armamento
                      </div>
                      <div className="text-white font-military font-bold text-xs mt-0.5">
                        {openCourse.specs.arma}
                      </div>
                    </div>
                  )}
                  {openCourse.specs.alvos && (
                    <div className="bg-black/60 border border-gray-800 rounded-lg p-3 text-center">
                      <Award className="w-5 h-5 text-cbt-orange mx-auto mb-1" />
                      <div className="text-[10px] font-tactical uppercase text-gray-500 tracking-wider">
                        Alvos
                      </div>
                      <div className="text-white font-military font-bold text-sm mt-0.5">
                        {openCourse.specs.alvos}
                      </div>
                    </div>
                  )}
                </div>

                {/* Prerequisite warning */}
                {openCourse.specs.prerequisito && (
                  <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-yellow-300 font-tactical font-bold text-sm uppercase tracking-wide">
                        Pré-requisito obrigatório
                      </div>
                      <div className="text-yellow-100/80 font-tactical text-sm mt-1">
                        {openCourse.specs.prerequisito}
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                {openCourse.description && openCourse.description.length > 0 && (
                  <div>
                    <h4 className="text-cbt-orange font-military font-bold text-sm uppercase tracking-wider mb-3">
                      Sobre o curso
                    </h4>
                    <div className="space-y-3">
                      {openCourse.description.map((p, i) => (
                        <p key={i} className="text-gray-300 font-tactical text-sm leading-relaxed">
                          {p}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Phases */}
                {openCourse.phases && openCourse.phases.length > 0 && (
                  <div>
                    <h4 className="text-cbt-orange font-military font-bold text-sm uppercase tracking-wider mb-3">
                      Como é o curso
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {openCourse.phases.map((phase, i) => (
                        <div
                          key={i}
                          className="bg-black/40 border border-gray-800 rounded-lg p-4"
                        >
                          <div className="text-cbt-orange font-military font-bold text-xs uppercase tracking-wider mb-2">
                            {phase.title}
                          </div>
                          <p className="text-gray-300 font-tactical text-sm leading-relaxed">
                            {phase.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cronograma */}
                <div>
                  <h4 className="text-cbt-orange font-military font-bold text-sm uppercase tracking-wider mb-3">
                    Conteúdo programático
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {openCourse.cronograma.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2.5 bg-black/40 rounded-md border border-gray-800"
                      >
                        <CheckCircle2 className="w-4 h-4 text-cbt-orange flex-shrink-0 mt-0.5" />
                        <span className="text-gray-200 font-tactical text-sm leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div className="pt-4 border-t border-gray-800">
                  <p className="text-center text-gray-400 font-tactical text-sm mb-4">
                    Próximas turmas, datas e valores são informados pelo WhatsApp
                  </p>
                  <Button
                    asChild
                    size="lg"
                    className="w-full bg-cbt-orange hover:bg-cbt-orange/90 text-black font-tactical font-bold uppercase tracking-wide glow-orange transition-all"
                  >
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Inscrever-se neste curso
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Courses;
