import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  BookOpen, 
  FileQuestion, 
  Brain, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2,
  ListChecks
} from 'lucide-react';

type Step = 'initial' | 'custom' | 'existing';

const QuickStartGuide = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('initial');

  const handleExistingOpposition = () => {
    navigate('/test');
  };

  const handleCustomQuestions = () => {
    navigate('/crear-test');
  };

  const handleCustomPsychotechnics = () => {
    navigate('/psicotecnicos');
  };

  const renderInitialStep = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Opción: Usar oposición existente */}
      <button
        onClick={handleExistingOpposition}
        className="group p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/30 dark:to-background hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg transition-all text-left"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
            <ListChecks className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-blue-900 dark:text-blue-300 text-lg mb-2">
              {t('quickStart.useExisting')}
            </h4>
            <p className="text-muted-foreground text-sm mb-3">
              {t('quickStart.useExistingDesc')}
            </p>
            <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm">
              {t('quickStart.goToTest')}
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </button>

      {/* Opción: Crear tests personalizados */}
      <button
        onClick={() => setStep('custom')}
        className="group p-6 rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/30 dark:to-background hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-lg transition-all text-left"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/50 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-colors">
            <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-purple-900 dark:text-purple-300 text-lg mb-2">
              {t('quickStart.createCustom')}
            </h4>
            <p className="text-muted-foreground text-sm mb-3">
              {t('quickStart.createCustomDesc')}
            </p>
            <div className="flex items-center text-purple-600 dark:text-purple-400 font-medium text-sm">
              {t('quickStart.seeOptions')}
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </button>
    </div>
  );

  const renderCustomStep = () => (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setStep('initial')}
        className="mb-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        {t('quickStart.back')}
      </Button>

      <p className="text-muted-foreground mb-4">
        {t('quickStart.whatToGenerate')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Generar Preguntas */}
        <button
          onClick={handleCustomQuestions}
          className="group p-6 rounded-xl border-2 border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-900/30 dark:to-background hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-lg transition-all text-left"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-cyan-100 dark:bg-cyan-900/50 group-hover:bg-cyan-200 dark:group-hover:bg-cyan-800/50 transition-colors">
              <FileQuestion className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-cyan-900 dark:text-cyan-300 text-lg mb-2">
                {t('quickStart.generateQuestions')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('quickStart.generateQuestionsDesc')}
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 mb-3">
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                  {t('quickStart.questionsFeature1')}
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                  {t('quickStart.questionsFeature2')}
                </li>
              </ul>
              <div className="flex items-center text-cyan-600 dark:text-cyan-400 font-medium text-sm">
                {t('quickStart.start')}
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </button>

        {/* Generar Psicotécnicos */}
        <button
          onClick={handleCustomPsychotechnics}
          className="group p-6 rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/30 dark:to-background hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-lg transition-all text-left"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/50 group-hover:bg-orange-200 dark:group-hover:bg-orange-800/50 transition-colors">
              <Brain className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-orange-900 dark:text-orange-300 text-lg mb-2">
                {t('quickStart.generatePsychotechnics')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('quickStart.generatePsychotechnicsDesc')}
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 mb-3">
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-orange-500 dark:text-orange-400" />
                  {t('quickStart.psychoFeature1')}
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-orange-500 dark:text-orange-400" />
                  {t('quickStart.psychoFeature2')}
                </li>
              </ul>
              <div className="flex items-center text-orange-600 dark:text-orange-400 font-medium text-sm">
                {t('quickStart.start')}
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <Card className="bg-card shadow-lg border-2 border-dashed border-indigo-200 dark:border-indigo-800 mb-6">
      <CardHeader className="bg-gradient-to-r from-indigo-50 via-purple-50 to-cyan-50 dark:from-indigo-900/30 dark:via-purple-900/30 dark:to-cyan-900/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/50">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <CardTitle className="text-indigo-900 dark:text-indigo-300">
              {t('quickStart.title')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t('quickStart.subtitle')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {step === 'initial' && renderInitialStep()}
        {step === 'custom' && renderCustomStep()}
      </CardContent>
    </Card>
  );
};

export default QuickStartGuide;
