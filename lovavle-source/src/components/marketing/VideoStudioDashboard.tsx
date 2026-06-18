import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import VideoStudioUsageBanner from "./VideoStudioUsageBanner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/lib/toastUtils";
import {
  Upload, Scissors, Send, BarChart3, Loader2, Play, Download,
  Sparkles, Video, FileVideo, Clock, CheckCircle, AlertCircle, Trash2, RefreshCw, Edit, Wand2
} from "lucide-react";
import ClipTimelineEditor from "./ClipTimelineEditor";
import PublishToSocialDialog from "./PublishToSocialDialog";
import SocialPublicationsPanel from "./SocialPublicationsPanel";
import CreativeStudioDialog from "./CreativeStudioDialog";

interface VideoClip {
  id: string;
  title: string;
  hook_score: number;
  start_time: number;
  end_time: number;
  suggested_caption: string;
  status: string;
  output_url: string | null;
  render_id: string | null;
}

interface AnalysisResult {
  impact_score: number;
  suggestions: { category: string; suggestion: string }[];
  segment_analysis: { segment: string; relevance: number; reasoning: string }[];
}

interface VideoStudioDashboardProps {
  portalId?: string;
}

const VideoStudioDashboard = ({ portalId }: VideoStudioDashboardProps = {}) => {
  const [tab, setTab] = useState("upload");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [processingClips, setProcessingClips] = useState<Set<string>>(new Set());
  const [clipping, setClipping] = useState(false);
  const [editingClip, setEditingClip] = useState<VideoClip | null>(null);
  const [publishingClip, setPublishingClip] = useState<VideoClip | null>(null);
  const [creativeClip, setCreativeClip] = useState<VideoClip | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unified pipeline progress
  const [pipelineActive, setPipelineActive] = useState(false);
  const [pipelineStep, setPipelineStep] = useState("");
  const [pipelinePercent, setPipelinePercent] = useState(0);
  const [pipelineDetail, setPipelineDetail] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024 * 1024) {
        toast.error("El archivo no puede superar 500MB");
        return;
      }
      setVideoFile(file);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!videoFile && !videoUrl) {
      toast.error("Sube un video o pega una URL");
      return;
    }

    setPipelineActive(true);
    setPipelineStep("Subiendo video");
    setPipelinePercent(0);
    setPipelineDetail("");

    try {
      let sourceUrl = videoUrl;

      if (videoFile) {
        setPipelineDetail(`0 MB / ${(videoFile.size / (1024 * 1024)).toFixed(1)} MB`);
        const path = `studio/${Date.now()}-${videoFile.name}`;

        sourceUrl = await new Promise<string>((resolve, reject) => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            const token = s?.access_token;
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

            const xhr = new XMLHttpRequest();
            const url = `${supabaseUrl}/storage/v1/object/video-clips/${path}`;

            xhr.upload.addEventListener("progress", (e) => {
              if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                // Upload = 0-40% of total pipeline
                setPipelinePercent(Math.round(pct * 0.4));
                setPipelineDetail(
                  `${(e.loaded / (1024 * 1024)).toFixed(1)} MB / ${(e.total / (1024 * 1024)).toFixed(1)} MB`
                );
              }
            });

            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                const { data: urlData } = supabase.storage.from("video-clips").getPublicUrl(path);
                resolve(urlData.publicUrl);
              } else {
                reject(new Error(`Error al subir: ${xhr.statusText}`));
              }
            });

            xhr.addEventListener("error", () => reject(new Error("Error de conexión al subir")));

            xhr.open("POST", url);
            xhr.setRequestHeader("Authorization", `Bearer ${token || anonKey}`);
            xhr.setRequestHeader("apikey", anonKey);
            xhr.setRequestHeader("x-upsert", "true");
            xhr.send(videoFile);
          });
        });
      } else {
        // URL mode — skip upload phase
        setPipelinePercent(40);
      }

      // Step 2: Analyze content (40-65%)
      setPipelineStep("Analizando contenido");
      setPipelinePercent(42);
      setPipelineDetail("Evaluando impacto con Bullfy Brain...");

      const { data: analysisData, error: analysisError } = await supabase.functions.invoke("analyze-campaign-content", {
        body: { asset_url: sourceUrl, asset_type: "video", copy_text: "" },
      });

      if (analysisError && !analysisData) {
        throw new Error("Error de conexión con el servidor. Verifica tu conexión e intenta de nuevo.");
      }
      if (!analysisData?.ok) {
        throw new Error(analysisData?.error || "No se pudo completar el análisis de impacto.");
      }

      setPipelinePercent(60);
      setPipelineDetail("Procesando resultados...");

      const analysisResult = analysisData.analysis || analysisData;
      if (analysisData.warning) {
        toast("Bullfy Brain respondió de forma intermitente; se aplicó un análisis preliminar.");
      }
      setAnalysis({
        impact_score: analysisResult.impact_score || 0,
        suggestions: analysisResult.suggestions || [],
        segment_analysis: analysisResult.segment_analysis || [],
      });

      // Step 3: Detect clips (65-90%)
      setPipelineStep("Detectando momentos virales");
      setPipelinePercent(67);
      setPipelineDetail("Buscando los mejores clips...");

      const { data: clipData, error: clipError } = await supabase.functions.invoke("analyze-video-clips", {
        body: { video_url: sourceUrl, source_type: "upload" },
      });

      if (clipError && !clipData) {
        throw new Error("Error de conexión al detectar clips. Intenta de nuevo.");
      }
      if (!clipData?.ok) {
        throw new Error(clipData?.error || "No se pudieron detectar los clips virales.");
      }

      setPipelinePercent(88);
      setPipelineDetail("Organizando clips...");

      const detectedClips: VideoClip[] = (clipData.analysis?.clips || clipData.clips || []).map((c: any, i: number) => ({
        id: `clip-${i}`,
        title: c.title || `Clip ${i + 1}`,
        hook_score: c.hook_score || 0,
        start_time: c.start_time || 0,
        end_time: c.end_time || 0,
        suggested_caption: c.suggested_caption || "",
        status: "detected",
        output_url: null,
        render_id: null,
      }));

      // Step 4: Finalize (90-100%)
      setPipelineStep("Finalizando");
      setPipelinePercent(95);
      setPipelineDetail("Preparando resultados...");

      setClips(detectedClips);
      setVideoUrl(sourceUrl);

      setPipelinePercent(100);
      setPipelineDetail("¡Listo!");

      await new Promise(r => setTimeout(r, 600));
      toast.success(`Análisis completado: ${detectedClips.length} clips detectados`);
      setTab("clips");
    } catch (err: any) {
      toast.error("Error: " + (err.message || "Error desconocido"));
    } finally {
      setPipelineActive(false);
      setPipelineStep("");
      setPipelinePercent(0);
      setPipelineDetail("");
    }
  };

  const handleGenerateClip = async (clip: VideoClip) => {
    setProcessingClips(prev => new Set([...prev, clip.id]));
    try {
      const { data, error } = await supabase.functions.invoke("generate-video-clip", {
        body: {
          source_url: videoUrl,
          start_time: clip.start_time,
          end_time: clip.end_time,
          title: clip.title,
          subtitle_text: clip.suggested_caption,
          portal_id: portalId,
        },
      });

      if (error) throw error;

      setClips(prev =>
        prev.map(c =>
          c.id === clip.id ? { ...c, status: "processing", render_id: data.render_id } : c
        )
      );
      toast.success(`Clip "${clip.title}" en proceso de renderizado`);
    } catch (err: any) {
      toast.error("Error al generar clip: " + (err.message || ""));
    } finally {
      setProcessingClips(prev => {
        const next = new Set(prev);
        next.delete(clip.id);
        return next;
      });
    }
  };

  const handleCheckStatus = async (clip: VideoClip) => {
    if (!clip.render_id) return;
    try {
      const { data, error } = await supabase.functions.invoke("check-clip-status", {
        body: { render_id: clip.render_id },
      });
      if (error) throw error;

      if (data.status === "done") {
        setClips(prev =>
          prev.map(c =>
            c.id === clip.id ? { ...c, status: "ready", output_url: data.output_url } : c
          )
        );
        toast.success(`Clip "${clip.title}" listo para descargar`);
      } else if (data.status === "failed") {
        setClips(prev => prev.map(c => c.id === clip.id ? { ...c, status: "error" } : c));
        toast.error("El renderizado falló");
      } else {
        toast.info(`Estado: ${data.status} (${data.progress || 0}%)`);
      }
    } catch (err: any) {
      toast.error("Error al verificar: " + (err.message || ""));
    }
  };

  const handleGenerateAll = async () => {
    setClipping(true);
    for (const clip of clips.filter(c => c.status === "detected")) {
      await handleGenerateClip(clip);
    }
    setClipping(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <VideoStudioUsageBanner />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upload" className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Subir Video
          </TabsTrigger>
          <TabsTrigger value="clips" className="gap-1.5" disabled={clips.length === 0}>
            <Scissors className="w-3.5 h-3.5" /> Clips ({clips.length})
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-1.5" disabled={!analysis}>
            <BarChart3 className="w-3.5 h-3.5" /> Análisis
          </TabsTrigger>
          <TabsTrigger value="publications" className="gap-1.5">
            <Send className="w-3.5 h-3.5" /> Publicaciones
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Video Studio
              </CardTitle>
              <CardDescription>
                Sube un video o pega una URL. La IA analizará el contenido, detectará momentos virales y generará clips verticales con subtítulos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File upload */}
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {videoFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileVideo className="w-8 h-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium text-foreground">{videoFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setVideoFile(null); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Video className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">Haz clic para seleccionar un video</p>
                    <p className="text-xs text-muted-foreground mt-1">MP4, MOV, AVI — máx 500MB</p>
                  </>
                )}
              </div>

              {/* URL alternative */}
              <div className="flex items-center gap-2">
                <div className="h-px bg-border flex-1" />
                <span className="text-xs text-muted-foreground">o pega una URL</span>
                <div className="h-px bg-border flex-1" />
              </div>

              <Input
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://ejemplo.com/video.mp4"
                disabled={!!videoFile}
              />

              <Button
                onClick={handleUploadAndAnalyze}
                disabled={pipelineActive || (!videoFile && !videoUrl)}
                className="w-full gap-2"
                size="lg"
              >
                {pipelineActive ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {pipelineStep}...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Analizar y Detectar Clips</>
                )}
              </Button>

              {/* Unified pipeline progress */}
              {pipelineActive && (
                <div className="space-y-3 animate-fade-in rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm font-medium text-foreground">{pipelineStep}</span>
                  </div>
                  <Progress value={pipelinePercent} className="h-2.5" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{pipelinePercent}%</span>
                    {pipelineDetail && <span>{pipelineDetail}</span>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clips Tab */}
        <TabsContent value="clips" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-display font-bold text-foreground">Clips Detectados</h3>
              <p className="text-sm text-muted-foreground">
                La IA identificó {clips.length} momentos con potencial viral
              </p>
            </div>
            <Button onClick={handleGenerateAll} disabled={clipping || clips.every(c => c.status !== "detected")} className="gap-1.5">
              {clipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
              Generar Todos
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clips.map(clip => (
              <Card key={clip.id} className="overflow-hidden">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground truncate">{clip.title}</h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {formatTime(clip.start_time)} — {formatTime(clip.end_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={clip.hook_score >= 80 ? "default" : clip.hook_score >= 60 ? "secondary" : "outline"}
                        className="shrink-0"
                      >
                        🔥 {clip.hook_score}
                      </Badge>
                      {clip.status === "ready" && <Badge className="bg-green-500/10 text-green-600 border-green-500/20 shrink-0"><CheckCircle className="w-3 h-3 mr-1" /> Listo</Badge>}
                      {clip.status === "processing" && <Badge variant="secondary" className="shrink-0"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Procesando</Badge>}
                      {clip.status === "error" && <Badge variant="destructive" className="shrink-0"><AlertCircle className="w-3 h-3 mr-1" /> Error</Badge>}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground italic">"{clip.suggested_caption}"</p>

                  <div className="flex flex-wrap gap-2">
                    {clip.status === "detected" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditingClip(clip)} className="gap-1">
                          <Edit className="w-3 h-3" /> Editar
                        </Button>
                        <Button size="sm" onClick={() => handleGenerateClip(clip)} disabled={processingClips.has(clip.id)} className="gap-1">
                          {processingClips.has(clip.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                          Generar Clip
                        </Button>
                      </>
                    )}
                    {clip.status === "processing" && (
                      <Button size="sm" variant="outline" onClick={() => handleCheckStatus(clip)} className="gap-1">
                        <RefreshCw className="w-3 h-3" /> Verificar Estado
                      </Button>
                    )}
                    {clip.status === "ready" && clip.output_url && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => window.open(clip.output_url!, "_blank")} className="gap-1">
                          <Play className="w-3 h-3" /> Ver
                        </Button>
                        <Button size="sm" variant="outline" asChild className="gap-1">
                          <a href={clip.output_url} download>
                            <Download className="w-3 h-3" /> Descargar
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setCreativeClip(clip)}>
                          <Wand2 className="w-3 h-3" /> Creatividad IA
                        </Button>
                        <Button size="sm" className="gap-1" onClick={() => setPublishingClip(clip)}>
                          <Send className="w-3 h-3" /> Publicar
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="mt-4 space-y-4">
          {analysis && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Puntuación de Impacto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold text-primary">{analysis.impact_score}</div>
                    <div className="flex-1">
                      <Progress value={analysis.impact_score} className="h-3" />
                      <p className="text-sm text-muted-foreground mt-1">
                        {analysis.impact_score >= 80 ? "🔥 Excelente potencial de impacto" :
                         analysis.impact_score >= 60 ? "👍 Buen contenido con margen de mejora" :
                         "💡 Considera las sugerencias para mejorar"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {analysis.segment_analysis.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Relevancia por Segmento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis.segment_analysis.map((seg, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{seg.segment}</span>
                          <span className="text-sm text-muted-foreground">{seg.relevance}%</span>
                        </div>
                        <Progress value={seg.relevance} className="h-2" />
                        <p className="text-xs text-muted-foreground">{seg.reasoning}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {analysis.suggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Sugerencias de Optimización</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysis.suggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                          <Badge variant="outline" className="shrink-0 text-xs">{s.category}</Badge>
                          <p className="text-sm text-foreground">{s.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="publications" className="mt-4">
          <SocialPublicationsPanel />
        </TabsContent>
      </Tabs>

      <ClipTimelineEditor
        open={!!editingClip}
        onOpenChange={(o) => !o && setEditingClip(null)}
        clip={editingClip}
        videoUrl={videoUrl}
        onSave={(updated) => {
          setClips((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
        }}
      />

      <PublishToSocialDialog
        open={!!publishingClip}
        onOpenChange={(o) => !o && setPublishingClip(null)}
        clipId={publishingClip?.id || null}
        defaultCaption={publishingClip?.suggested_caption || publishingClip?.title || ""}
      />

      <CreativeStudioDialog
        open={!!creativeClip}
        onOpenChange={(o) => !o && setCreativeClip(null)}
        clipId={creativeClip?.id || null}
        defaultText={creativeClip?.suggested_caption || creativeClip?.title || ""}
      />
    </div>
  );
};

export default VideoStudioDashboard;

