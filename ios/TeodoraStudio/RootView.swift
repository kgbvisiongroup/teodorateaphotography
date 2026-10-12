// Prijava i glavna navigacija aplikacije.
import SwiftUI

struct RootView: View {
    @EnvironmentObject var session: Session

    var body: some View {
        Group {
            switch session.state {
            case .checking:
                ZStack { Brand.wash.ignoresSafeArea(); ProgressView() }
            case .loggedOut:
                LoginView()
            case .loggedIn:
                MainTabs()
            }
        }
        .task { await session.restore() }
    }
}

// MARK: - Prijava

struct LoginView: View {
    @EnvironmentObject var session: Session
    @EnvironmentObject var api: API

    @State private var server = ""
    @State private var username = ""
    @State private var password = ""
    @State private var busy = false
    @FocusState private var focus: Field?

    private enum Field { case server, user, pass }

    var body: some View {
        ZStack {
            Brand.wash.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 18) {
                    Image(systemName: "camera.aperture")
                        .font(.system(size: 54, weight: .light))
                        .foregroundStyle(Brand.accent)
                        .padding(.top, 50)
                    Text("Teodora Photography Studio")
                        .font(.title2.weight(.semibold))
                        .multilineTextAlignment(.center)
                    Text("Prijavite se na svoj panel")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    VStack(spacing: 14) {
                        field("Adresa servera", text: $server, placeholder: "panel.teodorateaphotography.com", focus: .server)
                            .keyboardType(.URL)
                            .textContentType(.URL)
                        field("Korisničko ime", text: $username, placeholder: "admin", focus: .user)
                            .textContentType(.username)
                        secureField("Lozinka", text: $password)

                        if let e = session.error {
                            Text(e)
                                .font(.footnote)
                                .foregroundStyle(Brand.err)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button {
                            Task {
                                busy = true
                                await session.login(server: server, username: username, password: password)
                                busy = false
                            }
                        } label: {
                            HStack {
                                if busy { ProgressView().tint(.white) }
                                Text(busy ? "Prijavljujem…" : "Prijavi se")
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                        }
                        .background(Brand.accent, in: Capsule())
                        .foregroundStyle(.white)
                        .disabled(busy || server.isEmpty || username.isEmpty || password.isEmpty)

                        Text("Ostajete prijavljeni na ovom uređaju dok se sami ne odjavite.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(20)
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .shadow(color: .black.opacity(0.06), radius: 18, y: 8)
                }
                .padding(.horizontal, 20)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
        }
        .onAppear { if server.isEmpty { server = api.baseURL } }
    }

    private func field(_ label: String, text: Binding<String>, placeholder: String, focus f: Field) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.footnote).foregroundStyle(.secondary)
            TextField(placeholder, text: text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focus, equals: f)
                .padding(12)
                .background(Brand.wash, in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private func secureField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.footnote).foregroundStyle(.secondary)
            SecureField("", text: text)
                .textContentType(.password)
                .focused($focus, equals: .pass)
                .padding(12)
                .background(Brand.wash, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}

// MARK: - Glavne kartice

struct MainTabs: View {
    @EnvironmentObject var session: Session
    @State private var unread = 0

    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Danas", systemImage: "house") }

            BookingsView()
                .tabItem { Label("Zakazivanja", systemImage: "calendar") }

            OffersView()
                .tabItem { Label("Ponude", systemImage: "doc.text") }

            RequestsView()
                .tabItem { Label("Upiti", systemImage: "tray.full") }
                .badge(unread)

            MoreView()
                .tabItem { Label("Više", systemImage: "ellipsis.circle") }
        }
        .task {
            if let n: NotesResponse = try? await API.shared.get("/api/admin/notifications") {
                unread = n.unread
            }
        }
    }
}
