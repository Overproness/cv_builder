import { Card, CardContent } from "@/components/ui/card";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

const PAGE_SIZE = 25;

async function getUsers(email, page) {
  await dbConnect();

  const filter = email ? { email: { $regex: email, $options: "i" } } : {};
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("name email role createdAt tokenUsage.totalCost tokenUsage.totalTokens")
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    User.countDocuments(filter),
  ]);

  return { users, total };
}

export default async function AdminUsersPage({ searchParams }) {
  const params = await searchParams;
  const email = params?.email || "";
  const page = Math.max(1, Number(params?.page) || 1);

  const { users, total } = await getUsers(email, page);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Users</h1>
        <p className="text-muted-foreground text-sm">{total} total</p>
      </div>

      <form className="max-w-sm">
        <input
          type="text"
          name="email"
          defaultValue={email}
          placeholder="Search by email..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </form>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium">Joined</th>
                <th className="p-4 font-medium">AI cost</th>
                <th className="p-4 font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-b border-border last:border-0">
                  <td className="p-4">{u.name}</td>
                  <td className="p-4">{u.email}</td>
                  <td className="p-4">{u.role || "user"}</td>
                  <td className="p-4">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-4">${(u.tokenUsage?.totalCost || 0).toFixed(3)}</td>
                  <td className="p-4">{u.tokenUsage?.totalTokens || 0}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/admin/users?email=${encodeURIComponent(email)}&page=${p}`}
              className={`px-3 py-1 rounded-lg border border-border ${
                p === page ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
