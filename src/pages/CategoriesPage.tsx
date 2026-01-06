import { type FormEvent, useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import Button from "../components/Button";
import Card from "../components/Card";
import ErrorBanner from "../components/ErrorBanner";
import Input from "../components/Input";
import {
  type Category,
  type Direction,
  type FirestoreErrorInfo,
  archiveCategory,
  createCategory,
  getFirestoreErrorInfo,
  getFirestoreErrorMessage,
  listCategories,
  updateCategory,
} from "../lib/firestore";
import { useAuth } from "../providers/AuthProvider";

const directionLabels: Record<Direction, string> = {
  income: "Receita",
  expense: "Despesa",
};

const CategoriesPage = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [archivedCategories, setArchivedCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<Direction>("expense");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingType, setEditingType] = useState<Direction>("expense");
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingError, setEditingError] = useState("");

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    setLoading(true);

    const unsubscribeActive = listCategories(
      user.uid,
      false,
      (items) => {
        setCategories(items);
        setLoading(false);
      },
      (err) => {
        setError(getFirestoreErrorInfo(err));
        setLoading(false);
      }
    );

    const unsubscribeArchived = listCategories(
      user.uid,
      true,
      (items) => {
        setArchivedCategories(items);
      },
      (err) => {
        setError(getFirestoreErrorInfo(err));
      }
    );

    return () => {
      unsubscribeActive();
      unsubscribeArchived();
    };
  }, [user]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      return;
    }

    if (!name.trim()) {
      setFormError("Informe um nome de categoria.");
      return;
    }

    try {
      setCreating(true);
      setFormError("");
      await createCategory(user.uid, { name: name.trim(), type });
      setName("");
    } catch (err) {
      setFormError(getFirestoreErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setEditingType(category.type);
    setEditingError("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
    setEditingType("expense");
    setEditingError("");
  };

  const handleSave = async () => {
    if (!user || !editingId) {
      return;
    }

    if (!editingName.trim()) {
      setEditingError("Informe um nome valido.");
      return;
    }

    try {
      setEditingLoading(true);
      setEditingError("");
      await updateCategory(user.uid, editingId, {
        name: editingName.trim(),
        type: editingType,
      });
      cancelEditing();
    } catch (err) {
      setEditingError(getFirestoreErrorMessage(err));
    } finally {
      setEditingLoading(false);
    }
  };

  const handleArchive = async (categoryId: string, archived: boolean) => {
    if (!user) {
      return;
    }

    try {
      await archiveCategory(user.uid, categoryId, archived);
    } catch (err) {
      setError(getFirestoreErrorInfo(err));
    }
  };

  return (
    <AppShell title="Categorias" subtitle="Gerencie receitas e despesas">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Nova categoria</h2>
          <p className="text-sm text-slate-500">
            Crie categorias para organizar seus lancamentos.
          </p>

          {formError ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {formError}
            </div>
          ) : null}

          <form className="mt-4 space-y-4" onSubmit={handleCreate}>
            <Input
              label="Nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Salario, Mercado"
            />

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Tipo</span>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={type}
                onChange={(event) => setType(event.target.value as Direction)}
              >
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
              </select>
            </label>

            <Button type="submit" className="w-full" loading={creating}>
              Criar categoria
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Categorias ativas</h2>
          <p className="text-sm text-slate-500">
            Edite ou arquive quando nao usar mais.
          </p>

          <ErrorBanner info={error} className="mt-4" />

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Carregando...</p>
          ) : null}

          {!loading && categories.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Nenhuma categoria criada ainda.
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="rounded-xl border border-slate-100 bg-white px-4 py-3"
              >
                {editingId === category.id ? (
                  <div className="space-y-3">
                    {editingError ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                        {editingError}
                      </div>
                    ) : null}
                    <Input
                      label="Nome"
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                    />
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-slate-700">Tipo</span>
                      <select
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editingType}
                        onChange={(event) =>
                          setEditingType(event.target.value as Direction)
                        }
                        disabled={editingLoading}
                      >
                        <option value="income">Receita</option>
                        <option value="expense">Despesa</option>
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleSave} loading={editingLoading}>
                        Salvar
                      </Button>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={cancelEditing}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {category.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {directionLabels[category.type]}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => startEditing(category)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        className="border-rose-200 text-rose-600 hover:border-rose-300"
                        onClick={() => handleArchive(category.id, true)}
                      >
                        Arquivar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Arquivadas</h2>
        <p className="text-sm text-slate-500">Reative quando precisar.</p>

        {archivedCategories.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhuma categoria arquivada.</p>
        ) : null}

        <div className="mt-4 space-y-3">
          {archivedCategories.map((category) => (
            <div
              key={category.id}
              className="rounded-xl border border-slate-100 bg-white px-4 py-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {category.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {directionLabels[category.type]}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => handleArchive(category.id, false)}
                >
                  Reativar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
};

export default CategoriesPage;