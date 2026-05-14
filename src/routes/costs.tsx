import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IngredientLibrary } from "@/components/costs/ingredient-library";
import { SyrupLibrary } from "@/components/costs/syrup-library";
import { DisposableLibrary } from "@/components/costs/disposable-library";

export const Route = createFileRoute("/costs")({ component: CostsPage });

function CostsPage() {
  return (
    <AppShell>
      <header className="mb-4">
        <h1 className="text-2xl font-black tracking-tight">Cost Calculator</h1>
        <p className="text-sm text-muted-foreground">Ingredients and syrups feed per-serving cost.</p>
      </header>

      <Tabs defaultValue="ingredients" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
          <TabsTrigger value="syrups">Syrups</TabsTrigger>
          <TabsTrigger value="disposables">Disposables</TabsTrigger>
        </TabsList>
        <TabsContent value="ingredients" className="mt-4"><IngredientLibrary /></TabsContent>
        <TabsContent value="syrups" className="mt-4"><SyrupLibrary /></TabsContent>
        <TabsContent value="disposables" className="mt-4"><DisposableLibrary /></TabsContent>
      </Tabs>
    </AppShell>
  );
}
