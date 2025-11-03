
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Scale, Heart, Shield, Briefcase, Calculator, Globe } from 'lucide-react';

interface CategorySelectorProps {
  onCategorySelect: (category: string) => void;
  onBack: () => void;
}

const categories = [
  {
    id: 'administrativo',
    name: 'Administrativo del Estado',
    icon: Briefcase,
    description: 'Derecho administrativo, constitucional y organización del Estado',
    questionCount: 250,
    color: 'blue'
  },
  {
    id: 'justicia',
    name: 'Auxilio Judicial',
    icon: Scale,
    description: 'Derecho procesal, civil, penal y organización judicial',
    questionCount: 180,
    color: 'purple'
  },
  {
    id: 'sanidad',
    name: 'Personal Sanitario',
    icon: Heart,
    description: 'Anatomía, fisiología, farmacología y primeros auxilios',
    questionCount: 320,
    color: 'red'
  },
  {
    id: 'seguridad',
    name: 'Fuerzas de Seguridad',
    icon: Shield,
    description: 'Legislación policial, derechos fundamentales y seguridad',
    questionCount: 210,
    color: 'green'
  },
  {
    id: 'hacienda',
    name: 'Hacienda Pública',
    icon: Calculator,
    description: 'Derecho tributario, contabilidad y gestión financiera',
    questionCount: 190,
    color: 'orange'
  },
  {
    id: 'internacional',
    name: 'Relaciones Exteriores',
    icon: Globe,
    description: 'Derecho internacional, diplomacia y política exterior',
    questionCount: 150,
    color: 'indigo'
  }
];

const CategorySelector: React.FC<CategorySelectorProps> = ({ onCategorySelect, onBack }) => {
  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600 hover:bg-blue-200',
      purple: 'bg-purple-100 text-purple-600 hover:bg-purple-200',
      red: 'bg-red-100 text-red-600 hover:bg-red-200',
      green: 'bg-green-100 text-green-600 hover:bg-green-200',
      orange: 'bg-orange-100 text-orange-600 hover:bg-orange-200',
      indigo: 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getButtonClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-600 hover:bg-blue-700',
      purple: 'bg-purple-600 hover:bg-purple-700',
      red: 'bg-red-600 hover:bg-red-700',
      green: 'bg-green-600 hover:bg-green-700',
      orange: 'bg-orange-600 hover:bg-orange-700',
      indigo: 'bg-indigo-600 hover:bg-indigo-700'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Button variant="ghost" onClick={onBack} className="mr-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">Selecciona una Categoría</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Card key={category.id} className="hover:shadow-xl transition-all hover:scale-105">
                <CardHeader className="text-center pb-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${getColorClasses(category.color)}`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <CardTitle className="text-xl">{category.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {category.description}
                  </CardDescription>
                  <div className="text-xs text-gray-500 mt-2">
                    {category.questionCount} preguntas disponibles
                  </div>
                </CardHeader>
                <CardContent>
                  <Button 
                    className={`w-full ${getButtonClasses(category.color)}`} 
                    size="lg"
                    onClick={() => onCategorySelect(category.id)}
                  >
                    Empezar Quiz
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <div className="bg-white rounded-lg p-6 max-w-2xl mx-auto shadow-lg">
            <h2 className="text-xl font-semibold mb-4">💡 Consejos para el Quiz</h2>
            <div className="text-left space-y-2 text-gray-600">
              <p>• Lee cada pregunta cuidadosamente antes de responder</p>
              <p>• Utiliza el proceso de eliminación para las respuestas difíciles</p>
              <p>• Gestiona bien tu tiempo, especialmente en modo simulacro</p>
              <p>• Revisa las explicaciones después de cada pregunta</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategorySelector;
