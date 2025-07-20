import { TopFriends } from "@/components/user/top-friends"
import { AllFriends } from "@/components/user/all-friends"
import { UserProfileSearch } from "@/components/user/user-profile-search"

export default function UserProfilePage({
  params,
}: {
  params: { username: string }
}) {
  const { username } = params

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <UserProfileSearch initialUsername={username} />

      <h1 className="text-3xl font-bold">Profile: {username}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <TopFriends username={username} />
        </div>
        <div className="lg:col-span-2">
          <AllFriends username={username} />
        </div>
      </div>
    </div>
  )
}
